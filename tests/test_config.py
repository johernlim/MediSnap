import pytest
from pydantic import ValidationError
from app.config import Settings


def test_hosted_provider_requires_secret():
    with pytest.raises(ValidationError, match='ROBOFLOW_API_KEY'):
        Settings(_env_file=None, yolo_provider='roboflow', roboflow_api_key='')


@pytest.mark.parametrize('field,value', [
    ('roboflow_api_url', 'http://attacker.invalid'),
    ('roboflow_model_id', 'different-model/1'),
])
def test_hosted_provider_is_pinned(field, value):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, yolo_provider='roboflow', roboflow_api_key='secret', **{field: value})
