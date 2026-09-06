"""Deterministic conservative scoring. Detection scores never enter this module."""
from collections import Counter
import re

from ..config import Settings
from ..models.schemas import Candidate, MatchResult, Medicine, MedicineVisualEvidence
from ..utils.text_utils import contains_phrase, contains_same_tokens, normalize_text, strengths

GENERIC_TEXT = {'tablet', 'tablets', 'capsule', 'capsules', 'medicine', 'mg', 'ml', 'mcg',
                'iu', 'white', 'oval', 'film', 'coated', 'oral'}


def has_product_word(text: str) -> bool:
    return any(len(token) >= 3 and any(c.isalpha() for c in token) and token not in GENERIC_TEXT
               for token in normalize_text(text).split())


def distinctive_product_tokens(text: str | None) -> Counter:
    """Keep brand/product words while excluding form and strength tokens."""
    return Counter(token for token in normalize_text(text).split()
                   if token not in GENERIC_TEXT and not token.isdecimal()
                   and not re.fullmatch(r'\d+(?:\.\d+)?', token))


def contains_distinctive_product_name(observed: str | None,
                                      product_name: str | None) -> bool:
    observed_tokens = Counter(normalize_text(observed).split())
    required = distinctive_product_tokens(product_name)
    return bool(required) and all(observed_tokens[token] >= count
                                  for token, count in required.items())


class MatchingService:
    def __init__(self, settings: Settings):
        self.settings = settings

    def rank_candidates(self, visual_evidence: MedicineVisualEvidence,
                        npra_candidates: list[Medicine]) -> list[Candidate]:
        e, s = visual_evidence, self.settings
        if e.text_visibility in ('none', 'unreadable') or e.image_quality == 'poor':
            return []
        ranked = []
        texts = [v for v in [e.brand_name, e.imprint, e.packaging_text, *e.visible_text] if v]
        imprint_text = normalize_text(e.imprint)
        # An imprint is a physical marking, not an NPRA product/brand name. The
        # extraction response can also repeat that imprint in visible_text or
        # brand_name, so remove exact duplicates from product-name scoring.
        observed_brand = e.brand_name if normalize_text(e.brand_name) != imprint_text else None
        product_texts = [v for v in [observed_brand, e.packaging_text, *e.visible_text]
                         if v and normalize_text(v) != imprint_text]
        for medicine in npra_candidates:
            points = 0.0
            reasons, conflicts = [], []
            exact_imprint = bool(medicine.imprint and e.imprint and
                                 normalize_text(e.imprint) == normalize_text(medicine.imprint))
            # A printed exact registration number is an alternative identity anchor
            # in the same 40-point slot, never an extra 40 points or a fabricated imprint.
            registration = e.registration_number
            if not registration:
                registration = next((m.group() for t in texts for m in
                    re.finditer(r'\bMAL\d{8}[A-Z]+\b', t, re.I)), None)
            exact_registration = bool(registration and normalize_text(registration) ==
                                      normalize_text(medicine.registration_number))
            if exact_imprint or exact_registration:
                points += s.weight_imprint
                reasons.append('Exact authoritative imprint' if exact_imprint else 'Exact printed NPRA registration number')
            if registration and not exact_registration:
                conflicts.append('Visible registration number differs')
            visible_registrations = {m.group().upper() for t in texts for m in
                                     re.finditer(r'\bMAL\d{8}[A-Z]+\b', t, re.I)}
            if any(normalize_text(r) != normalize_text(medicine.registration_number) for r in visible_registrations):
                conflicts.append('Another visible registration number conflicts; photograph one package at a time')
            if medicine.imprint and e.imprint and not exact_imprint:
                conflicts.append('Visible imprint differs from authoritative imprint')

            distinctive_product_match = any(
                contains_distinctive_product_name(t, medicine.product_name)
                for t in product_texts)
            product_match = any(contains_phrase(medicine.product_name, t) or
                                contains_phrase(t, medicine.product_name) or
                                contains_same_tokens(t, medicine.product_name) for t in product_texts
                                if has_product_word(t)) or distinctive_product_match
            full_product = any(contains_phrase(t, medicine.product_name) or
                               contains_same_tokens(t, medicine.product_name)
                               for t in product_texts)
            if product_match:
                points += s.weight_product
                reasons.append('Visible text matches NPRA product name (not a verified pill imprint)')
            if observed_brand:
                brand_matches = (contains_phrase(medicine.product_name, observed_brand) or
                                 contains_phrase(observed_brand, medicine.product_name) or
                                 contains_same_tokens(medicine.product_name, observed_brand) or
                                 contains_same_tokens(observed_brand, medicine.product_name))
                if not brand_matches:
                    conflicts.append('Visible brand differs from product name')
            if e.manufacturer and medicine.manufacturer:
                if normalize_text(e.manufacturer) in {normalize_text(m) for m in medicine.manufacturer.split('\n')}:
                    points += s.weight_manufacturer
                    reasons.append('Visible manufacturer matches')
                elif not contains_phrase(medicine.manufacturer, e.manufacturer):
                    conflicts.append('Visible manufacturer differs')
            observed_strength = strengths(' '.join(v for v in [e.dosage, e.dosage_unit] if v))
            printed_strength = strengths(' '.join(product_texts))
            if not observed_strength:
                observed_strength = printed_strength
            candidate_strength = strengths(medicine.strength or medicine.product_name)
            strength_match = False
            if observed_strength and candidate_strength:
                if observed_strength == candidate_strength:
                    strength_match = True
                    points += s.weight_strength
                    reasons.append('Printed strength matches ' + ('NPRA strength' if medicine.strength else 'text in NPRA product name'))
                else:
                    conflicts.append('Visible strength differs or does not confirm the full strength')
            if e.dosage_form:
                form = normalize_text(e.dosage_form).rstrip('s')
                # Matching against product text is labelled, not stored as a source field.
                form_source = medicine.dosage_form or medicine.product_name
                tokens = [t.rstrip('s') for t in normalize_text(form_source).split()]
                if form and form in tokens:
                    points += s.weight_form
                    reasons.append('Visible dosage form matches ' + ('NPRA dosage form' if medicine.dosage_form else 'text in NPRA product name'))
                elif medicine.dosage_form or (form in {'tablet', 'capsule', 'solution', 'cream', 'ointment'}
                    and set(tokens) & {'tablet', 'capsule', 'solution', 'cream', 'ointment'}):
                    conflicts.append('Visible dosage form differs')
            if all([medicine.color, medicine.shape, e.color, e.shape]):
                if (normalize_text(e.color), normalize_text(e.shape)) == (normalize_text(medicine.color), normalize_text(medicine.shape)):
                    points += s.weight_appearance
                    reasons.append('Appearance agrees with authoritative candidate data')
            if e.active_ingredient and medicine.active_ingredient and not contains_phrase(medicine.active_ingredient, e.active_ingredient):
                conflicts.append('Visible ingredient differs from NPRA ingredients')
            if e.imprint or texts or registration:
                ranked.append(Candidate(medicine=medicine, score=round(points, 2), evidence_matches=reasons,
                    conflicts=conflicts, strong_identity=(exact_imprint or exact_registration or full_product or
                        (distinctive_product_match and candidate_strength and
                         printed_strength == candidate_strength))))
        return sorted(ranked, key=lambda c: (-c.score, c.medicine.registration_number))

    def decide(self, evidence: MedicineVisualEvidence, candidates: list[Medicine],
               truncated: bool = False) -> MatchResult:
        ranked = self.rank_candidates(evidence, candidates)
        if not ranked:
            identity_text = [evidence.imprint, evidence.brand_name, evidence.packaging_text,
                             evidence.registration_number, *evidence.visible_text]
            if not any(normalize_text(value) for value in identity_text if value):
                return MatchResult(message=('No readable imprint or product text was found. '
                    'Photograph the printed back foil or medicine box showing the product name, '
                    'strength, manufacturer, or MAL registration number.'))
            return MatchResult(message=('The visible text did not match a Malaysian NPRA product. '
                'Photograph more of the printed foil or box for additional identifying text.'))
        eligible = [c for c in ranked if not c.conflicts]
        displayed = eligible[:5] + [c for c in ranked if c.conflicts][:max(0, 5-len(eligible[:5]))]
        if not eligible:
            return MatchResult(candidates=displayed, message='Visible evidence conflicts with the NPRA candidates.')
        top = eligible[0]
        packaging_name_strength = self._packaging_name_strength_identity(evidence, top.medicine)
        level = ('HIGH' if top.score >= self.settings.match_high_threshold else
                 'MEDIUM' if top.score >= self.settings.match_medium_threshold else
                 'LOW' if top.score >= self.settings.match_low_threshold else 'UNKNOWN')
        result = MatchResult(score=top.score, identification_confidence=top.score/100,
                             confidence_level=level, candidates=displayed)
        if truncated:
            result.status = 'AMBIGUOUS'
            result.message = 'Too many products match the visible text. Provide more specific packaging evidence.'
        elif len(eligible) > 1 and top.score >= self.settings.weight_product and top.score - eligible[1].score < self.settings.match_margin:
            result.status = 'AMBIGUOUS'
            result.message = 'Multiple Malaysian products may match. Provide clearer markings or verify with a pharmacist.'
        elif (top.strong_identity and
              top.score >= min(self.settings.match_medium_threshold,
                               self.settings.weight_product + self.settings.weight_strength +
                               (0 if packaging_name_strength else self.settings.weight_form)) and
              (evidence.text_visibility == 'clear' or
               (evidence.text_visibility == 'partial' and packaging_name_strength))):
            result.status = 'MATCH_FOUND'
            result.medicine = top.medicine
            result.message = 'A Malaysian NPRA product is supported by the visible evidence. Professional verification is required.'
        elif top.score >= self.settings.match_low_threshold:
            result.status = 'LOW_CONFIDENCE'
            result.message = 'A possible candidate was found, but evidence is insufficient for identification.'
        return result

    @staticmethod
    def _packaging_name_strength_identity(evidence: MedicineVisualEvidence,
                                          medicine: Medicine) -> bool:
        imprint = normalize_text(evidence.imprint)
        product_texts = [value for value in [evidence.brand_name, evidence.packaging_text,
                                             *evidence.visible_text]
                         if value and normalize_text(value) != imprint]
        name_matches = any(contains_distinctive_product_name(value, medicine.product_name)
                           for value in product_texts)
        # This stronger identity path is available only when the strength is
        # actually present in readable product/packaging text. A separately
        # inferred dosage field is not enough to confirm a product.
        observed_strengths = strengths(' '.join(product_texts))
        candidate_strengths = strengths(medicine.strength or medicine.product_name)
        return bool(name_matches and observed_strengths and candidate_strengths and
                    observed_strengths == candidate_strengths)
