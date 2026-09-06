"""Synthetic fixtures test software behavior, never medicine identification accuracy."""
import io
from types import SimpleNamespace
from unittest.mock import Mock

import numpy as np
from PIL import Image
import pytest

from app.config import Settings
from app.database.database import import_csv
from app.models.schemas import (GeneralMedicineGuidance, Medicine, MedicineVisualEvidence,
                                PreliminaryMedicineSummary, SearchResponse)


@pytest.fixture
def settings(tmp_path):
    return Settings(_env_file=None, openai_api_key='', openai_model='',
                    yolo_model_path=tmp_path / 'missing.pt', npra_database_path=tmp_path / 'npra.db')


@pytest.fixture
def image():
    return Image.fromarray(np.random.default_rng(8).integers(30, 220, (256, 256, 3), dtype=np.uint8))


@pytest.fixture
def image_bytes(image):
    output = io.BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


@pytest.fixture
def evidence():
    return MedicineVisualEvidence(imprint='TESTMARK', visible_text=['TESTPRODUCT 10 mg tablets'],
        brand_name='TESTPRODUCT', manufacturer='TEST MAKER', color='white', shape='oval',
        dosage='10', dosage_unit='mg', dosage_form='tablet', packaging_text=None, other_markings=[],
        registration_number='MAL00000001T', active_ingredient=None, image_quality='good', text_visibility='clear')


@pytest.fixture
def medicine():
    return Medicine(id=1, product_name='TESTPRODUCT 10 mg tablets', registration_number='MAL00000001T',
                    manufacturer='TEST MAKER')


@pytest.fixture
def npra_db(tmp_path):
    source = tmp_path / 'npra.csv'
    source.write_text('reg_no,product,manufacturer,active_ingredient\n'
        'MAL00000001T,TESTPRODUCT 10 mg tablets,TEST MAKER,TEST INGREDIENT\n'
        'MAL00000002T,TESTPRODUCT 20 mg tablets,TEST MAKER,TEST INGREDIENT\n', encoding='utf-8')
    destination = tmp_path / 'npra.db'
    import_csv(source, destination)
    return destination


@pytest.fixture
def stubs(evidence, medicine):
    yolo = Mock(loaded=True)
    yolo.detect.return_value = []
    vision = Mock(configured=True)
    vision.analyze_medicine_image.return_value = evidence
    vision.suggest_identity_and_usage.return_value = None
    vision.preliminary_uses.return_value = PreliminaryMedicineSummary(
        possible_name='Test Ingredient', common_uses=['General test use'])
    vision.general_guidance_for_product.return_value = GeneralMedicineGuidance(
        common_uses=[], adult_general_dosage=None, child_general_dosage=None, dosage_notes=[])
    vision.possible_guidance_for_suggestion.return_value = GeneralMedicineGuidance(
        common_uses=[], adult_general_dosage='General adult label information.',
        child_general_dosage='A doctor must determine pediatric use.', dosage_notes=[])
    npra = Mock()
    npra.health.return_value = (True, 1, '2026-09-06')
    npra.search.return_value = SearchResponse(results=[medicine])
    npra.get.return_value = medicine
    return SimpleNamespace(yolo=yolo, vision=vision, npra=npra)
