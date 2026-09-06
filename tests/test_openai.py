from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from openai import OpenAIError
from app.models.schemas import (AIIdentitySuggestion, GeneralMedicineGuidance, Medicine,
                                MedicineVisualEvidence, PreliminaryMedicineSummary)
from app.services.openai_service import OpenAIService, VISUAL_PROMPT
from app.utils.errors import ProcessingError


@pytest.mark.parametrize('imprint,visibility', [('TESTMARK', 'clear'), ('TE', 'partial'), (None, 'unreadable'), (None, 'none')])
def test_structured_observation(settings, image, evidence, imprint, visibility):
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=evidence.model_copy(update={'imprint': imprint, 'text_visibility': visibility}))
    service = OpenAIService(settings, client=client)
    assert service.analyze_medicine_image(image).imprint == imprint
    args = client.responses.parse.call_args.kwargs
    assert args['store'] is False and args['text_format'] is MedicineVisualEvidence
    assert args['input'][0]['content'][1]['image_url'].startswith('data:image/jpeg;base64,')
    assert 'TESTPRODUCT' not in VISUAL_PROMPT


def test_invalid_response_retries_once(settings, image, evidence):
    client = Mock()
    client.responses.parse.side_effect = [SimpleNamespace(output_parsed={'invented': 'value'}), SimpleNamespace(output_parsed=evidence)]
    assert OpenAIService(settings, client).analyze_medicine_image(image) == evidence
    assert client.responses.parse.call_count == 2


def test_invalid_response_controlled_failure(settings, image):
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=None)
    with pytest.raises(ProcessingError):
        OpenAIService(settings, client).analyze_medicine_image(image)
    assert client.responses.parse.call_count == 2


def test_api_failure_not_retried(settings, image):
    client = Mock()
    client.responses.parse.side_effect = OpenAIError('sensitive SDK response')
    with pytest.raises(ProcessingError) as error:
        OpenAIService(settings, client).analyze_medicine_image(image)
    assert 'sensitive' not in str(error.value)
    assert client.responses.parse.call_count == 1


@pytest.mark.parametrize('status,code,expected', [
    (401, None, 'API key'),
    (403, None, 'permission'),
    (404, None, 'OPENAI_MODEL'),
    (429, 'insufficient_quota', 'credits'),
    (429, 'rate_limit_exceeded', 'rate limit'),
])
def test_api_failure_has_actionable_safe_message(settings, image, status, code, expected):
    client = Mock()
    failure = OpenAIError('sensitive SDK response')
    failure.status_code = status
    failure.code = code
    client.responses.parse.side_effect = failure
    with pytest.raises(ProcessingError) as error:
        OpenAIService(settings, client).analyze_medicine_image(image)
    assert expected.lower() in error.value.message.lower()
    assert 'sensitive' not in error.value.message


@pytest.mark.parametrize('code,expected', [
    ('credit_balance_exhausted', 'add credits'),
    ('project_spend_limit_exceeded', 'project limit'),
    ('organization_spend_limit_exceeded', 'organization limit'),
    ('organization_usage_limit_exceeded', 'limits page'),
])
def test_rate_limit_code_is_read_from_sdk_response_body(settings, image, code, expected):
    client = Mock()
    failure = OpenAIError('sensitive SDK response')
    failure.status_code = 429
    failure.body = {'error': {'code': code}}
    client.responses.parse.side_effect = failure
    with pytest.raises(ProcessingError) as error:
        OpenAIService(settings, client).analyze_medicine_image(image)
    assert expected in error.value.message.lower()
    assert 'sensitive' not in error.value.message


def test_unconfigured(settings, image):
    service = OpenAIService(settings)
    assert not service.configured
    with pytest.raises(ProcessingError):
        service.analyze_medicine_image(image)


def test_optional_identity_suggestion_is_structured_and_text_only(settings, evidence):
    suggestion = AIIdentitySuggestion(product_name='POSSIBLE TEST PRODUCT',
        active_ingredient='TEST INGREDIENT', strength='10 mg', dosage_form='tablet',
        common_uses=['General test use'], confidence='LOW', basis='Visible TEST marking')
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=suggestion)
    result = OpenAIService(settings, client).suggest_identity_and_usage(evidence)
    assert result == suggestion
    args = client.responses.parse.call_args.kwargs
    assert args['store'] is False and args['text_format'] is AIIdentitySuggestion
    assert 'input_image' not in str(args['input'])


def test_optional_identity_suggestion_skips_when_no_readable_text(settings, evidence):
    evidence = evidence.model_copy(update={'imprint': None, 'brand_name': None,
        'packaging_text': None, 'registration_number': None, 'visible_text': [],
        'text_visibility': 'none'})
    client = Mock()
    assert OpenAIService(settings, client).suggest_identity_and_usage(evidence) is None
    client.responses.parse.assert_not_called()


def test_verified_product_guidance_is_localized_and_structured(settings):
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(
        output_parsed=GeneralMedicineGuidance(common_uses=['Kegunaan ujian umum'],
            adult_general_dosage='Ikut label produk yang disahkan.',
            child_general_dosage='Doktor mesti menentukan dos kanak-kanak.',
            dosage_notes=['Dos bergantung pada indikasi.']))
    medicine = Medicine(id=1, product_name='TEST PRODUCT', registration_number='MAL00000001T',
                        active_ingredient='TEST INGREDIENT')
    result = OpenAIService(settings, client).general_guidance_for_product(medicine, 'ms')
    assert result.common_uses == ['Kegunaan ujian umum']
    assert result.child_general_dosage.startswith('Doktor')
    args = client.responses.parse.call_args.kwargs
    assert args['text_format'] is GeneralMedicineGuidance
    assert 'Bahasa Melayu' in str(args['input'])
    assert 'Never personalize a dose' in args['instructions']


def test_preliminary_ingredient_uses_are_structured_without_dosage(settings):
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=PreliminaryMedicineSummary(
        possible_name='Fenofibrate', common_uses=['General lipid management']))
    result = OpenAIService(settings, client).preliminary_uses('Fenofibrate', 'en')
    assert result.possible_name == 'Fenofibrate'
    args = client.responses.parse.call_args.kwargs
    assert args['text_format'] is PreliminaryMedicineSummary
    assert 'give dosage' in args['instructions']


def test_possible_packaging_guidance_is_structured_and_restricts_child_dose(settings):
    suggestion = AIIdentitySuggestion(product_name='UNLISTED TEST 10 mg tablet',
        active_ingredient='TEST INGREDIENT', strength='10 mg', dosage_form='tablet',
        common_uses=['Test use'], confidence='LOW', basis='Printed packaging')
    guidance = GeneralMedicineGuidance(common_uses=['Test use'],
        adult_general_dosage='General label information.',
        child_general_dosage='A doctor or pharmacist must determine suitability.',
        dosage_notes=['Verify the original leaflet.'])
    client = Mock()
    client.responses.parse.return_value = SimpleNamespace(output_parsed=guidance)
    result = OpenAIService(settings, client).possible_guidance_for_suggestion(suggestion, 'en')
    assert result == guidance
    args = client.responses.parse.call_args.kwargs
    assert args['text_format'] is GeneralMedicineGuidance
    assert 'do not give a numeric dose' in args['instructions']
