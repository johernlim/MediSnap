"""Detect with the explicitly configured pill model; never download a fallback."""
from dataclasses import dataclass
import base64
import io
import logging
import math
from threading import Lock

from PIL import Image
import httpx

from ..config import Settings
from ..utils.errors import ProcessingError
from ..utils.image_utils import crop_image

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    id: int
    bbox: list[int]
    crop_bbox: list[int]
    confidence: float
    class_id: int
    class_name: str
    crop: Image.Image
    source: str = 'yolo'


class YOLOService:
    def __init__(self, settings: Settings, model=None, http_client=None):
        self.settings = settings
        self.model = model
        self.http_client = http_client
        self.lock = Lock()

    @property
    def loaded(self) -> bool:
        return self.model is not None or (self.settings.yolo_provider == 'roboflow'
            and self.http_client is not None)

    def load(self) -> None:
        if self.loaded:
            return
        if self.settings.yolo_provider == 'roboflow':
            self.http_client = httpx.Client(
                base_url=self.settings.roboflow_api_url,
                headers={'Authorization': f'Bearer {self.settings.roboflow_api_key.get_secret_value()}'},
                timeout=self.settings.roboflow_timeout_seconds,
                follow_redirects=False,
            )
            logger.info('yolo_ready provider=roboflow model_id=%s', self.settings.roboflow_model_id)
            return
        path = self.settings.yolo_model_path
        if not path.exists():
            logger.warning('yolo_unavailable reason=selected_weights_missing')
            return
        try:
            from ultralytics import YOLO
            self.model = YOLO(str(path), task='detect')
        except Exception as exc:
            logger.error('yolo_load_failed error_type=%s', type(exc).__name__)

    def detect(self, image: Image.Image) -> list[Detection]:
        if not isinstance(image, Image.Image):
            raise ProcessingError('Invalid decoded image.', code=400)
        if not self.loaded:
            raise ProcessingError('Selected YOLO26 Pills detector is unavailable. Configure its local weights or Roboflow hosted API.')
        if self.settings.yolo_provider == 'roboflow':
            return self._detect_roboflow(image)
        try:
            with self.lock:
                results = self.model.predict(source=image, conf=self.settings.yolo_confidence_threshold,
                    iou=self.settings.yolo_iou_threshold, device=self.settings.yolo_device,
                    max_det=self.settings.max_detections + 1, save=False, verbose=False)
                detections = []
                for result in results:
                    for box in result.boxes or []:
                        confidence = float(box.conf[0])
                        raw = box.xyxy[0].tolist()
                        if not all(math.isfinite(v) for v in [confidence, *raw]):
                            continue
                        if confidence < self.settings.yolo_confidence_threshold:
                            continue
                        x1, y1, x2, y2 = map(int, raw)
                        bbox = [max(0, x1), max(0, y1), min(image.width, x2), min(image.height, y2)]
                        if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                            continue
                        crop, padded = crop_image(image, bbox, self.settings)
                        class_id = int(box.cls[0])
                        detections.append(Detection(len(detections)+1, bbox, padded, confidence,
                            class_id, str(result.names[class_id]), crop))
                if len(detections) > self.settings.max_detections:
                    raise ProcessingError('Too many medicines in one photo. Photograph fewer at a time.', code=422)
                return detections
        except ProcessingError:
            raise
        except Exception as exc:
            logger.error('yolo_inference_failed error_type=%s', type(exc).__name__)
            raise ProcessingError('Pill detection failed. Please retry with a clearer image.') from exc

    def _detect_roboflow(self, image: Image.Image) -> list[Detection]:
        """Call only the exact configured public model; API credentials stay in a header."""
        sent = image.copy()
        sent.thumbnail((self.settings.roboflow_max_side, self.settings.roboflow_max_side), Image.Resampling.LANCZOS)
        scale_x, scale_y = image.width / sent.width, image.height / sent.height
        output = io.BytesIO()
        sent.save(output, format='JPEG', quality=92)
        sent.close()
        payload = base64.b64encode(output.getvalue()).decode('ascii')
        project, version = self.settings.roboflow_model_id.split('/')
        try:
            with self.lock:
                response = self.http_client.post(
                    f'/{project}/{version}',
                    params={
                        'confidence': self.settings.yolo_confidence_threshold,
                        'overlap': self.settings.yolo_iou_threshold,
                        'max_detections': self.settings.max_detections + 1,
                        'disable_active_learning': 'true',
                    },
                    content=payload,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                )
                response.raise_for_status()
                body = response.json()
            predictions = body.get('predictions')
            if not isinstance(predictions, list):
                raise ValueError('Missing predictions array')
            detections = []
            for prediction in predictions:
                confidence = float(prediction['confidence'])
                x, y = float(prediction['x']), float(prediction['y'])
                width, height = float(prediction['width']), float(prediction['height'])
                values = [confidence, x, y, width, height]
                if not all(math.isfinite(value) for value in values) or confidence < self.settings.yolo_confidence_threshold:
                    continue
                raw = [(x-width/2)*scale_x, (y-height/2)*scale_y,
                       (x+width/2)*scale_x, (y+height/2)*scale_y]
                x1, y1, x2, y2 = map(int, raw)
                bbox = [max(0, x1), max(0, y1), min(image.width, x2), min(image.height, y2)]
                if bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                    continue
                crop, padded = crop_image(image, bbox, self.settings)
                class_id = int(prediction.get('class_id', -1))
                class_name = str(prediction.get('class') or 'pill')
                detections.append(Detection(len(detections)+1, bbox, padded, confidence,
                                            class_id, class_name, crop))
            if len(detections) > self.settings.max_detections:
                for detection in detections:
                    detection.crop.close()
                raise ProcessingError('Too many medicines in one photo. Photograph fewer at a time.', code=422)
            return detections
        except ProcessingError:
            raise
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            logger.error('roboflow_inference_failed error_type=%s', type(exc).__name__)
            raise ProcessingError('Roboflow pill detection is unavailable. Check the API key and try again.', code=502) from exc

    def close(self):
        if self.http_client is not None and hasattr(self.http_client, 'close'):
            self.http_client.close()
