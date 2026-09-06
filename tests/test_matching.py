import pytest
from app.models.schemas import Medicine
from app.services.matching_service import MatchingService
from app.utils.text_utils import contains_same_tokens, normalize_text, same_tokens, strengths


def test_normalization_preserves_strength_and_boundaries():
    assert normalize_text('FENO-TG 160 mg') == normalize_text('feno tg 160mg')
    assert strengths('10 mg / 5 ml') != strengths('10mg')


def test_product_tokens_allow_word_reordering_but_require_all_details():
    assert same_tokens('Ezenol Tablet 160 mg', 'Ezenol 160mg Tablet')
    assert contains_same_tokens('Ezenol 160mg Tablet Fenofibrate 160mg',
                                'Ezenol Tablet 160 mg')
    assert not same_tokens('Ezenol Tablet 160 mg', 'Ezenol Tablet 145 mg')
    assert not contains_same_tokens('Ezenol 160mg', 'Ezenol Tablet 160 mg')


def test_supported_packaging_match(settings, evidence, medicine):
    result = MatchingService(settings).decide(evidence, [medicine])
    assert result.status == 'MATCH_FOUND'
    assert result.score == 95
    assert result.medicine.strength is None
    assert result.confidence_level == 'HIGH'
    assert result.identification_confidence == .95


def test_no_double_count_product_text_as_imprint(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'registration_number': None, 'manufacturer': None,
        'dosage': None, 'dosage_unit': None, 'visible_text': ['TESTPRODUCT'], 'imprint': 'TESTPRODUCT',
        'brand_name': None, 'dosage_form': None})
    result = MatchingService(settings).decide(evidence, [medicine])
    assert result.status == 'UNKNOWN'
    assert result.score == 0
    assert result.medicine is None


def test_strength_text_is_not_brand_evidence(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'imprint': None, 'brand_name': None,
        'registration_number': None, 'manufacturer': None, 'visible_text': ['10 mg'], 'dosage_form': None})
    result = MatchingService(settings).decide(evidence, [medicine])
    assert result.score == 10 and result.status == 'UNKNOWN'


def test_true_authoritative_imprint_slot(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'registration_number': None})
    medicine = medicine.model_copy(update={'imprint': evidence.imprint})
    assert MatchingService(settings).decide(evidence, [medicine]).score == 95


@pytest.mark.parametrize('field,value', [('manufacturer', 'OTHER MAKER'), ('dosage', '20'),
    ('registration_number', 'MAL00000002T'), ('brand_name', 'OTHERBRAND')])
def test_conflicts_reject(settings, evidence, medicine, field, value):
    result = MatchingService(settings).decide(evidence.model_copy(update={field: value}), [medicine])
    assert result.status == 'UNKNOWN'
    assert result.medicine is None
    assert result.candidates[0].conflicts


def test_ratio_strength_conflict(settings, evidence, medicine):
    medicine = medicine.model_copy(update={'strength': '10 mg / 5 ml'})
    assert MatchingService(settings).decide(evidence, [medicine]).status == 'UNKNOWN'


def test_form_conflict_in_product_name(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'dosage_form': 'capsule'})
    assert MatchingService(settings).decide(evidence, [medicine]).status == 'UNKNOWN'


@pytest.mark.parametrize('visibility', ['none', 'unreadable'])
def test_no_text_even_if_model_invents_fields(settings, evidence, medicine, visibility):
    result = MatchingService(settings).decide(evidence.model_copy(update={'text_visibility': visibility}), [medicine])
    assert result.status == 'UNKNOWN' and result.score == 0


def test_appearance_only(settings, evidence, medicine):
    values = {k: None for k in ['imprint', 'brand_name', 'manufacturer', 'dosage', 'dosage_unit', 'registration_number']}
    evidence = evidence.model_copy(update={**values, 'visible_text': [], 'text_visibility': 'none'})
    medicine = medicine.model_copy(update={'color': 'white', 'shape': 'oval'})
    result = MatchingService(settings).decide(evidence, [medicine])
    assert result.status == 'UNKNOWN'
    assert 'back foil' in result.message


def test_partial_not_identity(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'imprint': 'TEST', 'brand_name': None, 'visible_text': ['TEST'],
        'registration_number': None, 'manufacturer': None, 'dosage': None, 'dosage_unit': None, 'dosage_form': None})
    assert MatchingService(settings).decide(evidence, [medicine]).score == 0


def test_ambiguous_candidates(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'registration_number': None})
    other = medicine.model_copy(update={'id': 2, 'registration_number': 'MAL00000002T'})
    result = MatchingService(settings).decide(evidence, [other, medicine])
    assert result.status == 'AMBIGUOUS' and result.medicine is None
    assert len(result.candidates) == 2


def test_truncated_retrieval_cannot_confirm(settings, evidence, medicine):
    assert MatchingService(settings).decide(evidence, [medicine], truncated=True).status == 'AMBIGUOUS'


def test_manufacturer_alternatives(settings, evidence, medicine):
    medicine = medicine.model_copy(update={'manufacturer': 'OTHER MAKER\nTEST MAKER'})
    assert MatchingService(settings).decide(evidence, [medicine]).status == 'MATCH_FOUND'


def test_unknown_and_low_confidence(settings, evidence, medicine):
    matcher = MatchingService(settings)
    assert matcher.decide(evidence, []).status == 'UNKNOWN'
    weak = evidence.model_copy(update={'registration_number': None,
        'visible_text': ['TESTPRODUCT']})
    assert matcher.decide(weak, [medicine]).status == 'LOW_CONFIDENCE'


def test_partial_reading_cannot_confirm(settings, evidence, medicine):
    partial = evidence.model_copy(update={
        'text_visibility': 'partial', 'visible_text': ['TESTPRODUCT'],
        'packaging_text': None,
    })
    result = MatchingService(settings).decide(partial, [medicine])
    assert result.status != 'MATCH_FOUND'


def test_multiple_printed_registrations_reject(settings, evidence, medicine):
    evidence = evidence.model_copy(update={'packaging_text': 'MAL00000001T MAL00000002T'})
    assert MatchingService(settings).decide(evidence, [medicine]).status == 'UNKNOWN'


def test_weak_brand_with_feno_scenario(settings, evidence):
    # Synthetic record only; this is not seeded into the application DB.
    medicine = Medicine(id=1, product_name='FENO-TG 160 mg', registration_number='SYNTHETIC-ONLY')
    evidence = evidence.model_copy(update={'imprint': 'FENO', 'brand_name': None, 'visible_text': ['FENO'],
        'manufacturer': None, 'dosage': None, 'dosage_unit': None, 'registration_number': None})
    result = MatchingService(settings).decide(evidence, [medicine])
    assert result.score == 0 and result.status == 'UNKNOWN'


def test_unique_full_product_strength_and_form_supports_packaging_confirmation(settings, evidence):
    target = Medicine(id=1, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ', active_ingredient='FENOFIBRATE[160mg;0]')
    other = Medicine(id=2, product_name='EP-Feno tablet 145 mg',
        registration_number='MAL26036029ARZ', active_ingredient='FENOFIBRATE[145 mg]')
    packaging = evidence.model_copy(update={
        'imprint': 'FENO', 'visible_text': ['FENO-TG 160mg tablet'], 'brand_name': 'FENO-TG',
        'manufacturer': None, 'dosage': '160', 'dosage_unit': 'mg', 'dosage_form': 'tablet',
        'registration_number': None, 'active_ingredient': None,
    })
    result = MatchingService(settings).decide(packaging, [target, other])
    assert result.status == 'MATCH_FOUND'
    assert result.medicine == target
    assert result.score == 40


def test_exact_ezenol_foil_outweighs_prior_feno_imprint(settings, evidence):
    ezenol = Medicine(id=1, product_name='Ezenol Tablet 160mg',
        registration_number='MAL14085013AZ', active_ingredient='FENOFIBRATE[160.00mg;0]')
    feno_tg = Medicine(id=2, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ', active_ingredient='FENOFIBRATE[160mg;0]')
    combined = evidence.model_copy(update={
        'imprint': 'FENO',
        'visible_text': ['FENO', 'EZENOL Tablet 160mg', 'Fenofibrate 160mg'],
        'brand_name': 'EZENOL', 'packaging_text': 'EZENOL Tablet 160mg Fenofibrate 160mg',
        'manufacturer': None, 'dosage': '160', 'dosage_unit': 'mg',
        'dosage_form': 'tablet', 'registration_number': None,
        'active_ingredient': 'Fenofibrate',
    })
    result = MatchingService(settings).decide(combined, [feno_tg, ezenol])
    assert result.status == 'MATCH_FOUND'
    assert result.medicine == ezenol
    assert result.score == 40
    feno_candidate = next(candidate for candidate in result.candidates
                          if candidate.medicine.id == feno_tg.id)
    assert feno_candidate.score == 15


def test_reordered_ezenol_name_confirms_same_unique_npra_product(settings, evidence):
    ezenol = Medicine(id=1, product_name='Ezenol Tablet 160mg',
        registration_number='MAL14085013AZ', active_ingredient='FENOFIBRATE[160.00mg;0]')
    other = Medicine(id=2, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ', active_ingredient='FENOFIBRATE[160mg;0]')
    packaging = evidence.model_copy(update={
        'imprint': 'FENO', 'visible_text': ['Ezenol 160mg Tablet', 'Fenofibrate 160mg'],
        'brand_name': 'Ezenol 160mg Tablet',
        'packaging_text': 'Ezenol 160mg Tablet Fenofibrate 160mg',
        'manufacturer': None, 'dosage': '160', 'dosage_unit': 'mg',
        'dosage_form': 'tablet', 'registration_number': None,
        'active_ingredient': 'Fenofibrate',
    })
    result = MatchingService(settings).decide(packaging, [other, ezenol])
    assert result.status == 'MATCH_FOUND'
    assert result.medicine == ezenol
    assert result.score == 40


@pytest.mark.parametrize('visibility', ['clear', 'partial'])
def test_ezenol_name_and_strength_confirm_when_structured_form_is_missing(
        settings, evidence, visibility):
    ezenol = Medicine(id=1, product_name='Ezenol Tablet 160mg',
        registration_number='MAL14085013AZ', active_ingredient='FENOFIBRATE[160.00mg;0]')
    other = Medicine(id=2, product_name='FENO-TG 160mg tablet',
        registration_number='MAL11045012AZ', active_ingredient='FENOFIBRATE[160mg;0]')
    packaging = evidence.model_copy(update={
        'imprint': 'FENO', 'visible_text': ['Ezenol', '160 mg', 'Fenofibrate'],
        'brand_name': 'Ezenol', 'packaging_text': 'Ezenol 160 mg Fenofibrate',
        'manufacturer': None, 'dosage': None, 'dosage_unit': None,
        'dosage_form': None, 'registration_number': None,
        'active_ingredient': 'Fenofibrate', 'text_visibility': visibility,
    })
    result = MatchingService(settings).decide(packaging, [other, ezenol])
    assert result.status == 'MATCH_FOUND'
    assert result.medicine == ezenol
    assert result.score == 35


def test_ezenol_different_strength_is_not_confirmed(settings, evidence):
    ezenol = Medicine(id=1, product_name='Ezenol Tablet 160mg',
        registration_number='MAL14085013AZ', active_ingredient='FENOFIBRATE[160.00mg;0]')
    packaging = evidence.model_copy(update={
        'imprint': None, 'visible_text': ['Ezenol 145 mg'], 'brand_name': 'Ezenol',
        'packaging_text': 'Ezenol 145 mg', 'manufacturer': None,
        'dosage': None, 'dosage_unit': None, 'dosage_form': None,
        'registration_number': None, 'active_ingredient': 'Fenofibrate',
    })
    result = MatchingService(settings).decide(packaging, [ezenol])
    assert result.status != 'MATCH_FOUND'
    assert result.medicine is None
