import io
from types import SimpleNamespace
from unittest.mock import Mock
import numpy as np
from PIL import Image
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.models.schemas import (AIIdentitySuggestion, GeneralMedicineGuidance, Medicine,
                                PreliminaryMedicineSummary, SearchResponse)
from app.services.npra_service import NPRAService
from app.services.recognition_service import RecognitionService
from app.services.yolo_service import Detection, YOLOService
from app.utils.errors import ProcessingError
from app.utils.image_utils import validate_image


def detection(image, number=1):
    return Detection(number, [0, 0, 256, 256], [0, 0, 256, 256], .91, 0, 'pill', image.copy())


def client(settings, stubs):
    return TestClient(create_app(settings, RecognitionService(settings, stubs.yolo, stubs.vision, stubs.npra)))


def test_health_no_secrets(settings, stubs):
    with client(settings, stubs) as api:
        response = api.get('/api/health')
        assert response.status_code == 200 and response.json()['status'] == 'healthy'
        assert 'api_key' not in response.text
        assert api.get('/docs').status_code == 200
        assert api.get('/redoc').status_code == 200
        assert '/api/recognize' in api.get('/openapi.json').json()['paths']


def test_default_degraded_startup(settings):
    with TestClient(create_app(settings)) as api:
        assert api.get('/api/health').json()['status'] == 'degraded'


def test_no_detection_uses_explicit_full_image_fallback(settings, stubs, image_bytes):
    with client(settings, stubs) as api:
        response = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')})
        data = response.json()
        assert data['status'] == 'MATCH_FOUND'
        assert data['detections'][0]['detection_source'] == 'full_image_fallback'
        assert data['detections'][0]['detection_confidence'] == 0
    stubs.vision.analyze_medicine_image.assert_called_once()


def test_recognition_accepts_spoken_language_and_localizes_general_uses(settings, stubs, image_bytes):
    stubs.vision.general_guidance_for_product.return_value = GeneralMedicineGuidance(
        common_uses=['Kegunaan umum'], adult_general_dosage='Dos dewasa umum.',
        child_general_dosage='Dos kanak-kanak mesti disahkan oleh doktor.',
        dosage_notes=['Baca risalah produk.'])
    with client(settings, stubs) as api:
        response = api.post('/api/recognize', data={'language': 'ms'},
                            files={'image': ('pill.png', image_bytes, 'image/png')})
    data = response.json()
    assert response.status_code == 200
    assert data['language'] == 'ms'
    assert data['detections'][0]['common_uses'] == ['Kegunaan umum']
    assert data['detections'][0]['general_guidance']['adult_general_dosage'] == 'Dos dewasa umum.'
    stubs.vision.general_guidance_for_product.assert_called_once()


def test_recognition_rejects_unsupported_language(settings, stubs, image_bytes):
    with client(settings, stubs) as api:
        response = api.post('/api/recognize', data={'language': 'xx'},
                            files={'image': ('pill.png', image_bytes, 'image/png')})
    assert response.status_code == 422
    stubs.yolo.detect.assert_not_called()


def test_invalid_previous_photo_evidence_is_rejected(settings, stubs, image_bytes):
    with client(settings, stubs) as api:
        response = api.post('/api/recognize', data={'previous_evidence': '{invalid'},
                            files={'image': ('package.png', image_bytes, 'image/png')})
    assert response.status_code == 400
    stubs.yolo.detect.assert_not_called()


def test_ambiguous_first_photo_then_packaging_photo_confirms_one_product(
        settings, stubs, evidence, image_bytes):
    feno = Medicine(id=10, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ', active_ingredient='FENOFIBRATE[160mg;0]')
    ep_feno = Medicine(id=11, product_name='EP-Feno tablet 145 mg',
        registration_number='MAL26036029ARZ', active_ingredient='FENOFIBRATE[145 mg]')
    cholib = Medicine(id=12, product_name='Cholib 145mg/20mg Film-Coated Tablet',
        registration_number='MAL00000012AZ',
        active_ingredient='FENOFIBRATE[145.0mg;],SIMVASTATIN[20.0mg;]')
    first_evidence = evidence.model_copy(update={
        'imprint': 'FENO', 'visible_text': ['FENO'], 'brand_name': None,
        'manufacturer': None, 'dosage': None, 'dosage_unit': None,
        'dosage_form': 'tablet', 'registration_number': None,
    })
    package_evidence = evidence.model_copy(update={
        'imprint': None, 'visible_text': ['FENO-TG 160mg tablet'], 'brand_name': 'FENO-TG',
        'manufacturer': None, 'dosage': '160', 'dosage_unit': 'mg',
        'dosage_form': 'tablet', 'registration_number': None,
    })
    stubs.vision.analyze_medicine_image.side_effect = [first_evidence, package_evidence]
    stubs.vision.preliminary_uses.return_value = PreliminaryMedicineSummary(
        possible_name='Fenofibrate', common_uses=['General lipid management'])
    stubs.npra.search.return_value = SearchResponse(results=[feno, ep_feno, cholib])
    with client(settings, stubs) as api:
        first = api.post('/api/recognize', files={
            'image': ('pill.png', image_bytes, 'image/png')}).json()
        assert first['status'] == 'UNKNOWN'
        assert first['detections'][0]['preliminary_summary']['possible_name'] == 'Fenofibrate'
        previous = first['detections'][0]['visual_evidence']
        second = api.post('/api/recognize', data={
            'language': 'en', 'previous_evidence': __import__('json').dumps(previous)}, files={
            'image': ('package.png', image_bytes, 'image/png')}).json()
    assert second['refinement_used'] is True
    assert second['status'] == 'MATCH_FOUND'
    assert second['detections'][0]['match']['medicine']['product_name'] == 'FENO-TG 160mg tablet'
    assert stubs.yolo.detect.call_count == 1


@pytest.mark.parametrize('name,mime,data,code', [('file.txt', 'text/plain', b'text', 415),
    ('pill.png', 'image/png', b'broken', 400), ('pill.jpg', 'image/png', b'text', 415)])
def test_invalid_files(settings, stubs, name, mime, data, code):
    with client(settings, stubs) as api:
        assert api.post('/api/recognize', files={'image': (name, data, mime)}).status_code == code
        assert api.post('/api/recognize').status_code == 400
    stubs.yolo.detect.assert_not_called()


def test_size_limit_before_detection(settings, stubs, image_bytes):
    settings.max_image_size_mb = .01
    with client(settings, stubs) as api:
        assert api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).status_code == 413
    stubs.yolo.detect.assert_not_called()


def test_multiple_pills_independent(settings, stubs, image, image_bytes):
    stubs.yolo.detect.return_value = [detection(image), detection(image, 2)]
    with client(settings, stubs) as api:
        data = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()
    assert data['status'] == 'MATCH_FOUND' and len(data['detections']) == 2
    assert data['detections'][0]['match']['score'] == 95
    assert data['detections'][0]['detection_confidence'] == .91
    assert stubs.vision.analyze_medicine_image.call_count == 2


def test_one_crop_failure_preserves_other(settings, stubs, evidence, image, image_bytes):
    stubs.yolo.detect.return_value = [detection(image), detection(image, 2)]
    stubs.vision.analyze_medicine_image.side_effect = [ProcessingError('Vision unavailable'), evidence]
    with client(settings, stubs) as api:
        data = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()
    assert data['status'] == 'PROCESSING_ERROR'
    assert [d['status'] for d in data['detections']] == ['PROCESSING_ERROR', 'MATCH_FOUND']


def test_unverified_ai_suggestion_is_checked_but_not_promoted_to_npra_match(
        settings, stubs, evidence, image, image_bytes):
    stubs.yolo.detect.return_value = [detection(image)]
    stubs.vision.analyze_medicine_image.return_value = evidence.model_copy(update={
        'imprint': 'FENO', 'visible_text': ['FENO'], 'brand_name': None,
        'manufacturer': None, 'dosage': None, 'dosage_unit': None,
        'dosage_form': 'tablet', 'registration_number': None,
    })
    stubs.vision.suggest_identity_and_usage.return_value = AIIdentitySuggestion(
        product_name='FENO-TG 160mg tablet', active_ingredient='Fenofibrate',
        strength='160 mg', dosage_form='tablet', common_uses=['General lipid management'],
        confidence='LOW', basis='Visible FENO marking')
    suggested_record = Medicine(id=2, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ')
    stubs.npra.search.side_effect = [SearchResponse(results=[]),
                                     SearchResponse(results=[suggested_record])]
    with client(settings, stubs) as api:
        data = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()
    detected = data['detections'][0]
    assert data['status'] == 'UNKNOWN' and detected['match']['medicine'] is None
    assert detected['ai_suggestion']['product_name'] == 'FENO-TG 160mg tablet'
    assert detected['ai_suggestion_npra_status'] == 'FOUND_IN_NPRA'
    assert detected['ai_suggestion_npra_record']['registration_number'] == 'MAL11045012AZ'


def test_npra_miss_allows_possible_guidance_only_for_clearly_printed_name_and_strength(
        settings, stubs, evidence, image_bytes):
    printed = evidence.model_copy(update={
        'imprint': None, 'visible_text': ['UNLISTED TEST 10 mg tablet'],
        'brand_name': 'UNLISTED TEST', 'packaging_text': 'UNLISTED TEST 10 mg tablet',
        'manufacturer': None, 'dosage': '10', 'dosage_unit': 'mg',
        'dosage_form': 'tablet', 'registration_number': None,
    })
    suggestion = AIIdentitySuggestion(product_name='UNLISTED TEST 10 mg tablet',
        active_ingredient='TEST INGREDIENT', strength='10 mg', dosage_form='tablet',
        common_uses=['General test use'], confidence='LOW', basis='Printed packaging')
    stubs.vision.analyze_medicine_image.return_value = printed
    stubs.vision.suggest_identity_and_usage.return_value = suggestion
    stubs.npra.search.return_value = SearchResponse(results=[])
    with client(settings, stubs) as api:
        detected = api.post('/api/recognize', files={
            'image': ('package.png', image_bytes, 'image/png')}).json()['detections'][0]
    assert detected['match']['medicine'] is None
    assert detected['ai_suggestion']['product_name'] == suggestion.product_name
    assert detected['possible_guidance']['adult_general_dosage'] == 'General adult label information.'
    stubs.vision.possible_guidance_for_suggestion.assert_called_once_with(suggestion, 'en')


def test_npra_unavailable_prevents_paid_call(settings, stubs, image, image_bytes):
    stubs.yolo.detect.return_value = [detection(image)]
    stubs.npra.health.return_value = (False, 0, None)
    with client(settings, stubs) as api:
        data = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()
    assert data['status'] == 'PROCESSING_ERROR'
    stubs.vision.analyze_medicine_image.assert_not_called()


def test_poor_image_prevents_inference(settings, stubs):
    output = io.BytesIO()
    Image.new('RGB', (256, 256), 'white').save(output, 'PNG')
    with client(settings, stubs) as api:
        assert api.post('/api/recognize', files={'image': ('pill.png', output.getvalue(), 'image/png')}).json()['status'] == 'IMAGE_TOO_POOR'
    stubs.yolo.detect.assert_not_called()


def test_poor_crop_prevents_openai(settings, stubs, image_bytes):
    stubs.yolo.detect.return_value = [detection(Image.new('RGB', (256, 256), 'white'))]
    with client(settings, stubs) as api:
        assert api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()['status'] == 'IMAGE_TOO_POOR'
    stubs.vision.analyze_medicine_image.assert_not_called()


def test_search_detail_and_validation(settings, stubs):
    with client(settings, stubs) as api:
        assert api.get('/api/search?q=TESTPRODUCT').status_code == 200
        assert api.get('/api/search?q=a').status_code == 422
        assert api.get('/api/medicine/1').status_code == 200
        stubs.npra.get.return_value = None
        assert api.get('/api/medicine/2').status_code == 404


def test_e2e_real_decode_crop_database_and_match(settings, stubs, npra_db, image_bytes):
    model = Mock()
    box = SimpleNamespace(conf=[.92], cls=[0], xyxy=np.array([[10, 10, 240, 240]]))
    model.predict.return_value = [SimpleNamespace(boxes=[box], names={0: 'pill'})]
    stubs.yolo = YOLOService(settings, model)
    stubs.npra = NPRAService(npra_db)
    with client(settings, stubs) as api:
        result = api.post('/api/recognize', files={'image': ('pill.png', image_bytes, 'image/png')}).json()
    assert result['status'] == 'MATCH_FOUND'
    assert result['detections'][0]['match']['medicine']['registration_number'] == 'MAL00000001T'


def test_orientation_metadata_and_format(settings, image):
    source = image.resize((160, 90))
    exif = Image.Exif()
    exif[274] = 6
    output = io.BytesIO()
    source.save(output, 'JPEG', exif=exif)
    clean = validate_image(output.getvalue(), 'pill.jpg', 'image/jpeg', settings)
    assert clean.size == (90, 160) and not clean.getexif()
    with pytest.raises(ProcessingError):
        validate_image(output.getvalue(), 'pill.png', 'image/png', settings)
