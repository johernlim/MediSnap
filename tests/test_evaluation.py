from scripts.evaluate import summarize


def test_false_identification_and_miss_are_counted():
    medicine = {'registration_number': 'TRUE', 'bbox': [0, 0, 100, 100], 'imprint': 'TEST'}
    detection = {'bbox': [0, 0, 100, 100], 'status': 'MATCH_FOUND',
        'match': {'medicine': {'registration_number': 'WRONG'}},
        'visual_evidence': {'imprint': 'TEST'}, 'vision_attempted': True}
    result = summarize([{'medicines': [medicine, {**medicine, 'bbox': [200, 200, 300, 300]}],
                         'response': {'detections': [detection], 'processing_time_ms': 100}}])
    assert result['false_identification_rate_among_confirmed'] == 1
    assert result['detection_recall_at_iou50'] == .5
    assert result['end_to_end_identification_accuracy_on_known_medicines'] == 0
    assert result['structured_output_success_rate'] == 1


def test_no_measurements_are_null():
    result = summarize([])
    assert result['false_identification_rate_among_confirmed'] is None
    assert result['mAP50'] is None
