"""Evaluate a small verified image manifest without training. Requires a running API.

The manifest is JSON: a list of {image, medicines: [{bbox, registration_number,
imprint?, visible_text?}]}. Boxes use oriented-image pixel coordinates. A null
registration_number explicitly means the identity is unknown/unregistered.
Output contains measurements only from supplied verified images, never benchmarks.
"""
import argparse
import json
import mimetypes
from pathlib import Path
import sys
from time import perf_counter

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.utils.text_utils import normalize_text  # noqa: E402


def iou(a, b):
    intersection = max(0, min(a[2], b[2])-max(a[0], b[0])) * max(0, min(a[3], b[3])-max(a[1], b[1]))
    union = (a[2]-a[0])*(a[3]-a[1]) + (b[2]-b[0])*(b[3]-b[1]) - intersection
    return intersection / union if union > 0 else 0


def summarize(cases: list[dict]) -> dict:
    counts = dict(truth_medicines=0, known_medicines=0, detections=0, true_detections=0,
        confirmed=0, correct_identifications=0, false_identifications=0, unknown=0,
        ambiguous=0, low_confidence=0, processing_errors=0, no_detection_images=0,
        vision_attempts=0, structured_success=0, imprint_labels=0, correct_imprints=0,
        visible_text_labels=0, correct_visible_text=0)
    durations, yolo_durations = [], []
    for case in cases:
        truth, response = case['medicines'], case['response']
        detections = response.get('detections', [])
        counts['truth_medicines'] += len(truth)
        counts['known_medicines'] += sum(t['registration_number'] is not None for t in truth)
        counts['detections'] += len(detections)
        durations.append(case.get('wall_time_ms', response.get('processing_time_ms', 0)))
        if 'yolo' in response.get('timings_ms', {}):
            yolo_durations.append(response['timings_ms']['yolo'])
        counts['no_detection_images'] += response.get('status') == 'NO_MEDICINE_DETECTED'
        paired, used = {}, set()
        # Greedy one-to-one localization assignment in descending IoU.
        overlaps = sorted([(iou(d['bbox'], t['bbox']), di, ti)
            for di, d in enumerate(detections) for ti, t in enumerate(truth)], reverse=True)
        for overlap, di, ti in overlaps:
            if overlap >= .5 and di not in paired and ti not in used:
                paired[di] = ti
                used.add(ti)
        counts['true_detections'] += len(paired)
        for index, detection in enumerate(detections):
            expected = truth[paired[index]] if index in paired else None
            status = detection['status']
            counts['unknown'] += status == 'UNKNOWN'
            counts['ambiguous'] += status == 'AMBIGUOUS'
            counts['low_confidence'] += status == 'LOW_CONFIDENCE'
            counts['processing_errors'] += status == 'PROCESSING_ERROR'
            evidence = detection.get('visual_evidence')
            # Count attempts only when pipeline instrumented them explicitly.
            counts['vision_attempts'] += bool(detection.get('vision_attempted', False))
            counts['structured_success'] += evidence is not None
            if status == 'MATCH_FOUND':
                counts['confirmed'] += 1
                product = (detection.get('match') or {}).get('medicine') or {}
                correct = bool(expected and expected['registration_number'] is not None and
                    product.get('registration_number') == expected['registration_number'])
                counts['correct_identifications'] += correct
                counts['false_identifications'] += not correct
            if expected and 'imprint' in expected:
                counts['imprint_labels'] += 1
                counts['correct_imprints'] += bool(evidence is not None and
                    normalize_text(evidence.get('imprint')) == normalize_text(expected['imprint']))
            if expected and 'visible_text' in expected:
                counts['visible_text_labels'] += 1
                counts['correct_visible_text'] += bool(evidence is not None and
                    {normalize_text(t) for t in evidence.get('visible_text', [])} ==
                    {normalize_text(t) for t in expected['visible_text']})
    def ratio(numerator, denominator):
        return round(numerator / denominator, 4) if denominator else None
    n = counts
    return {'scope': 'Supplied evaluation images only; not medical validation.', 'images': len(cases),
        'counts': counts, 'detection_precision_at_iou50': ratio(n['true_detections'], n['detections']),
        'detection_recall_at_iou50': ratio(n['true_detections'], n['truth_medicines']),
        'end_to_end_identification_accuracy_on_known_medicines': ratio(n['correct_identifications'], n['known_medicines']),
        'correct_match_rate_among_confirmed': ratio(n['correct_identifications'], n['confirmed']),
        'false_identification_rate_among_confirmed': ratio(n['false_identifications'], n['confirmed']),
        'false_identifications_per_detection': ratio(n['false_identifications'], n['detections']),
        'unknown_rate_per_detection': ratio(n['unknown'], n['detections']),
        'ambiguous_rate_per_detection': ratio(n['ambiguous'], n['detections']),
        'low_confidence_rate_per_detection': ratio(n['low_confidence'], n['detections']),
        'structured_output_success_rate': ratio(n['structured_success'], n['vision_attempts']),
        'imprint_exact_accuracy_on_labeled_detected_crops': ratio(n['correct_imprints'], n['imprint_labels']),
        'visible_text_exact_accuracy_on_labeled_detected_crops': ratio(n['correct_visible_text'], n['visible_text_labels']),
        'average_processing_time_ms': ratio(sum(durations), len(durations)),
        'average_yolo_inference_ms': ratio(sum(yolo_durations), len(yolo_durations)),
        'mAP50': None, 'mAP50_95': None,
        'map_note': 'For full precision-recall curves use --yolo-data with a small held-out detection set.'}


def evaluate_manifest(manifest_path: Path, base_url: str):
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    if not isinstance(manifest, list) or not manifest:
        raise ValueError('Manifest must be a nonempty list of verified evaluation images')
    cases = []
    with httpx.Client(timeout=600) as client:
        health = client.get(base_url + '/api/health')
        health.raise_for_status()
        if health.json().get('status') != 'healthy':
            raise ValueError('API is degraded. Supply selected YOLO weights, NPRA data and OpenAI settings first.')
        for case in manifest:
            for truth in case['medicines']:
                box = truth['bbox']
                if len(box) != 4 or box[2] <= box[0] or box[3] <= box[1] or 'registration_number' not in truth:
                    raise ValueError('Each verified medicine needs a valid bbox and registration_number (or null)')
            path = (manifest_path.parent / case['image']).resolve()
            tick = perf_counter()
            with path.open('rb') as image:
                response = client.post(base_url + '/api/recognize', files={
                    'image': (path.name, image, mimetypes.guess_type(path.name)[0] or 'application/octet-stream')})
            response.raise_for_status()
            cases.append({'medicines': case['medicines'], 'response': response.json(),
                          'wall_time_ms': round((perf_counter()-tick)*1000, 2)})
    return summarize(cases)


def evaluate_yolo(data: Path):
    from app.config import Settings
    from app.services.yolo_service import YOLOService
    service = YOLOService(Settings())
    service.load()
    if not service.loaded:
        raise ValueError('Selected pill model weights are unavailable')
    # Evaluation only. This never calls model.train().
    metrics = service.model.val(data=str(data.resolve()), split='val',
        device=service.settings.yolo_device, plots=False, save_json=False,
        project=str(ROOT / 'evaluation-results'), name='yolo-evaluation')
    return {'precision': metrics.box.mp, 'recall': metrics.box.mr, 'mAP50': metrics.box.map50,
            'mAP50_95': metrics.box.map, 'speed_ms': metrics.speed,
            'scope': 'Detection benchmark on specified held-out data, not medicine identification accuracy.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path)
    parser.add_argument('--api', default='http://localhost:8000')
    parser.add_argument('--yolo-data', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'evaluation-results/report.json')
    args = parser.parse_args()
    if not args.manifest and not args.yolo_data:
        parser.error('Supply --manifest and/or --yolo-data. No training data is required for normal use.')
    try:
        report = {}
        if args.manifest:
            report['pipeline'] = evaluate_manifest(args.manifest.resolve(), args.api.rstrip('/'))
        if args.yolo_data:
            report['yolo'] = evaluate_yolo(args.yolo_data)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report, indent=2))
        return 0
    except Exception as exc:
        print(f'Evaluation could not run: {type(exc).__name__}: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
