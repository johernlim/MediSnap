"""Independent per-detection processing with bounded concurrency and timings."""
import json
import logging
import re
from threading import BoundedSemaphore
from time import perf_counter

from PIL import Image

from ..config import Settings
from ..models.schemas import (DetectionResult, MedicineVisualEvidence,
                              PreliminaryMedicineSummary, RecognitionResponse)
from ..utils.errors import ProcessingError
from ..utils.image_utils import check_quality
from ..utils.text_utils import (contains_phrase, contains_same_tokens, normalize_text,
                               same_tokens, strengths)
from .matching_service import MatchingService
from .yolo_service import Detection

logger = logging.getLogger(__name__)


class RecognitionService:
    def __init__(self, settings: Settings, yolo, vision, npra):
        self.settings, self.yolo, self.vision, self.npra = settings, yolo, vision, npra
        self.matcher = MatchingService(settings)
        self.capacity = BoundedSemaphore(2)

    def recognize(self, image: Image.Image, language: str = 'en',
                  previous_evidence: MedicineVisualEvidence | None = None) -> RecognitionResponse:
        if not self.capacity.acquire(blocking=False):
            raise ProcessingError('Recognition is busy. Please retry shortly.', code=429)
        try:
            return self._recognize(image, language, previous_evidence)
        finally:
            self.capacity.release()

    def _recognize(self, image: Image.Image, language: str = 'en',
                   previous_evidence: MedicineVisualEvidence | None = None) -> RecognitionResponse:
        start = perf_counter()
        response = RecognitionResponse(success=False, status='UNKNOWN', message='', language=language,
                                       refinement_used=previous_evidence is not None,
                                       image_width=image.width, image_height=image.height)
        quality = check_quality(image, self.settings)
        if not quality.usable:
            response.status = 'IMAGE_TOO_POOR'
            response.message = 'Please take a clearer photo with the medicine closer to the camera.'
            return self._finish(response, start)
        tick = perf_counter()
        detections = [] if previous_evidence is not None else self.yolo.detect(image)
        response.timings_ms['yolo'] = round((perf_counter()-tick)*1000, 2)
        if not detections:
            # A narrow detector can miss clear medicines outside its 11 trained
            # classes. Analyze one bounded full-image region instead of hiding
            # readable visual evidence from the evidence-extraction stage.
            bounds = [0, 0, image.width, image.height]
            detections = [Detection(1, bounds, bounds, 0.0, -1,
                                    'full image', image.copy(), 'full_image_fallback')]
        for detection in detections:
            result = DetectionResult(id=detection.id, bbox=detection.bbox, crop_bbox=detection.crop_bbox,
                detection_confidence=detection.confidence, class_id=detection.class_id,
                class_name=detection.class_name, detection_source=detection.source, status='UNKNOWN')
            try:
                result.quality = check_quality(detection.crop, self.settings, crop=True)
                if min(detection.bbox[2]-detection.bbox[0], detection.bbox[3]-detection.bbox[1]) < self.settings.min_crop_side:
                    result.quality.usable = False
                    result.quality.reasons.append('Detected medicine itself is too small to read.')
                if not result.quality.usable:
                    result.status = 'IMAGE_TOO_POOR'
                    result.message = 'Please take a clearer close-up of this medicine.'
                else:
                    tick = perf_counter()
                    if not self.npra.health()[0]:
                        raise ProcessingError('The NPRA database is missing, empty, or unavailable. Import the official dataset.')
                    result.vision_attempted = True
                    try:
                        evidence = self.vision.analyze_medicine_image(detection.crop)
                    finally:
                        result.timings_ms['openai'] = round((perf_counter()-tick)*1000, 2)
                    if previous_evidence is not None:
                        evidence = self._merge_evidence(previous_evidence, evidence)
                    result.visual_evidence = evidence
                    if evidence.image_quality == 'poor':
                        result.status = 'IMAGE_TOO_POOR'
                        result.message = 'Visual analysis could not read this crop. Please take a clearer photo.'
                    else:
                        tick = perf_counter()
                        candidates = self.npra.search(imprint=evidence.imprint,
                            visible_text=[*evidence.visible_text, evidence.packaging_text],
                            brand_name=evidence.brand_name, manufacturer=evidence.manufacturer,
                            active_ingredient=evidence.active_ingredient,
                            registration_number=evidence.registration_number, limit=self.settings.candidate_limit)
                        result.timings_ms['npra_search'] = round((perf_counter()-tick)*1000, 2)
                        tick = perf_counter()
                        result.match = self.matcher.decide(evidence, candidates.results, candidates.truncated)
                        result.timings_ms['matching'] = round((perf_counter()-tick)*1000, 2)
                        result.status = result.match.status
                        result.message = result.match.message
                        if result.match.medicine is not None:
                            tick = perf_counter()
                            try:
                                result.general_guidance = self.vision.general_guidance_for_product(
                                    result.match.medicine, language)
                                result.common_uses = result.general_guidance.common_uses
                                if result.common_uses:
                                    result.common_uses_source = 'OPENAI_GENERAL_INFORMATION'
                            except ProcessingError as exc:
                                # Usage help is optional and must never hide the NPRA-backed result.
                                result.general_guidance_message = exc.message
                            finally:
                                result.timings_ms['general_guidance'] = round((perf_counter()-tick)*1000, 2)
                        if result.status != 'MATCH_FOUND':
                            tick = perf_counter()
                            try:
                                possible_name = self._shared_ingredient(result)
                                if possible_name:
                                    try:
                                        result.preliminary_summary = self.vision.preliminary_uses(
                                            possible_name, language)
                                    except ProcessingError as exc:
                                        result.preliminary_summary = PreliminaryMedicineSummary(
                                            possible_name=possible_name, common_uses=[])
                                        result.ai_suggestion_message = exc.message
                                else:
                                    suggestion = self.vision.suggest_identity_and_usage(evidence, language)
                                    if suggestion is not None:
                                        result.ai_suggestion = suggestion
                                        suggested = self.npra.search(
                                            visible_text=[suggestion.product_name],
                                            brand_name=suggestion.product_name,
                                            active_ingredient=suggestion.active_ingredient,
                                            limit=25,
                                        )
                                        exact = [medicine for medicine in suggested.results
                                                 if same_tokens(medicine.product_name,
                                                                suggestion.product_name)]
                                        if len(exact) == 1:
                                            result.ai_suggestion_npra_status = 'FOUND_IN_NPRA'
                                            result.ai_suggestion_npra_record = exact[0]
                                            result.ai_suggestion_message = ('The suggested product name exists in '
                                                'NPRA, but the photograph does not independently verify the identity.')
                                        else:
                                            result.ai_suggestion_npra_status = 'NOT_FOUND_IN_NPRA'
                                            result.ai_suggestion_message = ('This model-suggested product name was '
                                                'not found as one unique product in the NPRA snapshot.')
                                            if self._suggestion_supported_by_packaging(evidence, suggestion):
                                                try:
                                                    result.possible_guidance = (
                                                        self.vision.possible_guidance_for_suggestion(
                                                            suggestion, language))
                                                except ProcessingError as exc:
                                                    result.possible_guidance_message = exc.message
                            except ProcessingError as exc:
                                # Optional knowledge assistance must not erase the observed evidence/NPRA result.
                                result.ai_suggestion_message = exc.message
                            finally:
                                result.timings_ms['ai_suggestion'] = round((perf_counter()-tick)*1000, 2)
            except ProcessingError as exc:
                result.status, result.message = exc.status, exc.message
            except Exception as exc:
                # Log type and stage identifiers, never raw SDK response/image text.
                logger.error('detection_processing_failed id=%d error_type=%s', detection.id, type(exc).__name__)
                result.status = 'PROCESSING_ERROR'
                result.message = 'This medicine could not be processed. Please try again.'
            finally:
                detection.crop.close()
            response.detections.append(result)
        statuses = {d.status for d in response.detections}
        # The summary never implies that every pill matched when only some did.
        response.status = next(iter(statuses)) if len(statuses) == 1 else (
            'PROCESSING_ERROR' if 'PROCESSING_ERROR' in statuses else
            'AMBIGUOUS' if 'AMBIGUOUS' in statuses else 'UNKNOWN')
        response.success = any(d.status not in ('PROCESSING_ERROR', 'IMAGE_TOO_POOR') for d in response.detections)
        response.message = ('Review each detected medicine separately.' if len(statuses) > 1
                            else response.detections[0].message or 'Processing completed.')
        return self._finish(response, start)

    @staticmethod
    def _shared_ingredient(result: DetectionResult) -> str | None:
        if result.match is None:
            return None
        ingredient_sets = []
        display_names = {}
        for candidate in result.match.candidates:
            raw = candidate.medicine.active_ingredient
            if not raw:
                continue
            # Compare individual ingredient names. A combination product must
            # not hide an ingredient shared by every candidate.
            names = re.findall(r'([^,\[\]]+?)\s*\[', raw)
            if not names:
                names = [part for part in re.sub(r'\[[^\]]*\]', '', raw).split(',') if part.strip()]
            current = set()
            for name in names:
                cleaned = re.sub(r'\s+', ' ', name.replace(';', ' ')).strip()
                normalized = normalize_text(cleaned)
                if normalized:
                    current.add(normalized)
                    display_names.setdefault(normalized, cleaned.title())
            if current:
                ingredient_sets.append(current)
        if len(ingredient_sets) < 2:
            return None
        common = set.intersection(*ingredient_sets)
        if len(common) != 1:
            return None
        return display_names[next(iter(common))]

    @staticmethod
    def _suggestion_supported_by_packaging(evidence, suggestion) -> bool:
        if evidence.text_visibility != 'clear' or not suggestion.product_name or not suggestion.strength:
            return False
        packaging = ' '.join(value for value in [evidence.brand_name, evidence.packaging_text,
                                                  *evidence.visible_text] if value)
        return ((contains_phrase(packaging, suggestion.product_name) or
                 contains_same_tokens(packaging, suggestion.product_name)) and
                bool(strengths(packaging) & strengths(suggestion.strength)))

    @staticmethod
    def _merge_evidence(first: MedicineVisualEvidence,
                        second: MedicineVisualEvidence) -> MedicineVisualEvidence:
        def unique(values):
            output = []
            seen = set()
            for value in values:
                key = normalize_text(value)
                if key and key not in seen:
                    seen.add(key)
                    output.append(value)
            return output

        visibility_order = {'none': 0, 'unreadable': 1, 'partial': 2, 'clear': 3}
        text_visibility = max((first.text_visibility, second.text_visibility),
                              key=lambda value: visibility_order[value])
        return MedicineVisualEvidence(
            imprint=first.imprint or second.imprint,
            visible_text=unique([*first.visible_text, *second.visible_text]),
            brand_name=second.brand_name or first.brand_name,
            manufacturer=second.manufacturer or first.manufacturer,
            color=first.color or second.color,
            shape=first.shape or second.shape,
            dosage=second.dosage or first.dosage,
            dosage_unit=second.dosage_unit or first.dosage_unit,
            dosage_form=second.dosage_form or first.dosage_form,
            packaging_text=' '.join(unique([value for value in
                [first.packaging_text, second.packaging_text] if value])) or None,
            other_markings=unique([*first.other_markings, *second.other_markings]),
            registration_number=second.registration_number or first.registration_number,
            active_ingredient=second.active_ingredient or first.active_ingredient,
            image_quality=second.image_quality,
            text_visibility=text_visibility,
        )

    @staticmethod
    def _finish(response, start):
        response.processing_time_ms = round((perf_counter()-start)*1000, 2)
        logger.info(json.dumps({'event': 'recognition_completed', 'status': response.status,
            'detection_count': len(response.detections), 'processing_time_ms': response.processing_time_ms,
            'timings_ms': response.timings_ms, 'detections': [
                {'id': d.id, 'status': d.status, 'timings_ms': d.timings_ms} for d in response.detections]}))
        return response
