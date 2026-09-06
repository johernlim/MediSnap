from types import SimpleNamespace
from unittest.mock import Mock
import numpy as np
import pytest
from app.services.yolo_service import YOLOService
from app.utils.errors import ProcessingError


class HostedResponse:
    def __init__(self, body=None, failure=None):
        self.body, self.failure = body or {}, failure

    def raise_for_status(self):
        if self.failure:
            raise self.failure

    def json(self):
        return self.body


def boxes(confidences):
    return [SimpleNamespace(conf=[c], cls=[0], xyxy=np.array([[5, 5, 250, 250]])) for c in confidences]


@pytest.mark.parametrize('confidences,count', [([], 0), ([.9], 1), ([.9, .8], 2), ([.3], 0), ([.9, .1], 1)])
def test_detection(settings, image, confidences, count):
    model = Mock()
    model.predict.return_value = [SimpleNamespace(boxes=boxes(confidences), names={0: 'pill'})]
    service = YOLOService(settings, model=model)
    service.load()
    results = service.detect(image)
    assert len(results) == count
    if results:
        assert results[0].crop_bbox == [0, 0, 256, 256]
        assert results[0].class_name == 'pill'
    assert model.predict.call_args.kwargs['save'] is False


def test_missing_model_no_fallback(settings, image):
    service = YOLOService(settings)
    service.load()
    assert not service.loaded
    with pytest.raises(ProcessingError, match='weights'):
        service.detect(image)


def test_invalid_image(settings):
    with pytest.raises(ProcessingError):
        YOLOService(settings).detect(b'broken')


def test_inference_failure(settings, image):
    model = Mock()
    model.predict.side_effect = RuntimeError('internal path')
    with pytest.raises(ProcessingError, match='detection failed'):
        YOLOService(settings, model).detect(image)


def test_detection_limit_does_not_silently_drop(settings, image):
    settings.max_detections = 1
    model = Mock()
    model.predict.return_value = [SimpleNamespace(boxes=boxes([.8, .9]), names={0: 'pill'})]
    with pytest.raises(ProcessingError, match='Too many'):
        YOLOService(settings, model).detect(image)


def test_roboflow_hosted_detection(settings, image):
    settings.yolo_provider = 'roboflow'
    settings.roboflow_api_key = 'test-secret'
    http_client = Mock()
    http_client.post.return_value = HostedResponse({'predictions': [{
        'x': 128, 'y': 128, 'width': 200, 'height': 100,
        'confidence': .92, 'class_id': 7, 'class': 'pill-code',
    }]})
    service = YOLOService(settings, http_client=http_client)
    result = service.detect(image)[0]
    assert result.bbox == [28, 78, 228, 178]
    assert result.class_id == 7 and result.class_name == 'pill-code'
    call = http_client.post.call_args
    assert call.args[0] == '/pills-kxe6h-afvos/12'
    assert call.kwargs['params']['disable_active_learning'] == 'true'
    assert 'api_key' not in call.kwargs['params']
    assert 'test-secret' not in str(call)


def test_roboflow_invalid_response_is_controlled(settings, image):
    settings.yolo_provider = 'roboflow'
    settings.roboflow_api_key = 'test-secret'
    http_client = Mock()
    http_client.post.return_value = HostedResponse({'unexpected': []})
    with pytest.raises(ProcessingError, match='Roboflow'):
        YOLOService(settings, http_client=http_client).detect(image)


def test_roboflow_closes_client(settings):
    settings.yolo_provider = 'roboflow'
    settings.roboflow_api_key = 'test-secret'
    http_client = Mock()
    service = YOLOService(settings, http_client=http_client)
    service.close()
    http_client.close.assert_called_once()
