"""Validated environment settings; relative paths resolve against backend/."""
from pathlib import Path

from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / '.env', extra='ignore')

    openai_api_key: SecretStr = SecretStr('')
    openai_model: str = ''
    openai_timeout_seconds: float = Field(45, gt=0)
    yolo_provider: Literal['local', 'roboflow'] = 'local'
    yolo_model_path: Path = Path('models/yolo26_pills.pt')
    yolo_confidence_threshold: float = Field(0.50, ge=0, le=1)
    yolo_iou_threshold: float = Field(0.45, ge=0, le=1)
    yolo_device: str = 'cpu'
    roboflow_api_key: SecretStr = SecretStr('')
    roboflow_api_url: str = 'https://serverless.roboflow.com'
    roboflow_model_id: str = 'pills-kxe6h-afvos/12'
    roboflow_timeout_seconds: float = Field(60, gt=0, le=300)
    roboflow_max_side: int = Field(2048, ge=320, le=4096)
    max_detections: int = Field(12, ge=1, le=100)
    npra_database_path: Path = Path('data/npra/medicines.db')
    max_image_size_mb: float = Field(10, gt=0, le=50)
    max_image_pixels: int = Field(20_000_000, ge=1024)
    min_image_side: int = Field(64, ge=1)
    min_crop_side: int = Field(48, ge=1)
    crop_padding: float = Field(0.08, ge=0, le=0.5)
    crop_max_side: int = Field(1536, ge=64)
    blur_threshold: float = Field(8, ge=0)
    brightness_min: float = Field(15, ge=0, le=255)
    brightness_max: float = Field(245, ge=0, le=255)
    match_high_threshold: float = Field(90, ge=0, le=100)
    match_medium_threshold: float = Field(70, ge=0, le=100)
    match_low_threshold: float = Field(50, ge=0, le=100)
    match_margin: float = Field(15, ge=0, le=100)
    weight_imprint: float = Field(40, ge=0)
    weight_product: float = Field(25, ge=0)
    weight_manufacturer: float = Field(15, ge=0)
    weight_strength: float = Field(10, ge=0)
    weight_form: float = Field(5, ge=0)
    weight_appearance: float = Field(5, ge=0)
    candidate_limit: int = Field(500, ge=2, le=5000)
    cors_origins: str = 'http://localhost:8081,http://127.0.0.1:8081'

    @model_validator(mode='after')
    def validate_settings(self):
        if not self.match_low_threshold <= self.match_medium_threshold <= self.match_high_threshold:
            raise ValueError('Match thresholds must be ordered LOW <= MEDIUM <= HIGH')
        weights = [self.weight_imprint, self.weight_product, self.weight_manufacturer,
                   self.weight_strength, self.weight_form, self.weight_appearance]
        if abs(sum(weights) - 100) > 0.001:
            raise ValueError('Matching weights must sum to 100')
        if self.brightness_min >= self.brightness_max:
            raise ValueError('Brightness minimum must be below maximum')
        if self.yolo_provider == 'roboflow':
            if not self.roboflow_api_key.get_secret_value():
                raise ValueError('ROBOFLOW_API_KEY is required when YOLO_PROVIDER=roboflow')
            if self.roboflow_api_url != 'https://serverless.roboflow.com':
                raise ValueError('ROBOFLOW_API_URL must use the official HTTPS serverless endpoint')
            if self.roboflow_model_id != 'pills-kxe6h-afvos/12':
                raise ValueError('ROBOFLOW_MODEL_ID must remain pills-kxe6h-afvos/12')
        for field in ('yolo_model_path', 'npra_database_path'):
            path = getattr(self, field)
            if not path.is_absolute():
                setattr(self, field, (BACKEND_DIR / path).resolve())
        return self
