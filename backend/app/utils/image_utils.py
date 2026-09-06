"""Bounded decoding, metadata removal, padded crops, and cheap quality checks."""
import io
import warnings
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import Settings
from ..models.schemas import QualityResult
from .errors import ProcessingError

FORMATS = {'.jpg': ('image/jpeg', 'JPEG'), '.jpeg': ('image/jpeg', 'JPEG'),
           '.png': ('image/png', 'PNG'), '.webp': ('image/webp', 'WEBP')}


def validate_image(data: bytes, filename: str, mime: str, settings: Settings) -> Image.Image:
    if not data:
        raise ProcessingError('Please upload an image.', code=400)
    if len(data) > settings.max_image_size_mb * 1024 * 1024:
        raise ProcessingError('Image exceeds the configured upload limit.', code=413)
    expected = FORMATS.get(Path(filename or '').suffix.lower())
    if not expected or mime != expected[0]:
        raise ProcessingError('Upload a JPEG, PNG, or WEBP image with a matching extension.', code=415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as source:
                if source.format != expected[1] or getattr(source, 'n_frames', 1) != 1:
                    raise ProcessingError('Image format mismatch or animated image.', code=415)
                if source.width * source.height > settings.max_image_pixels:
                    raise ProcessingError('Image dimensions are too large.', code=413)
                if min(source.size) < settings.min_image_side:
                    raise ProcessingError('Please upload a larger, clearer image.', 'IMAGE_TOO_POOR', 422)
                source.verify()
            with Image.open(io.BytesIO(data)) as source:
                oriented = ImageOps.exif_transpose(source).convert('RGB')
                # A fresh image prevents retaining EXIF or other personal metadata.
                clean = Image.new('RGB', oriented.size)
                clean.paste(oriented)
                return clean
    except ProcessingError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise ProcessingError('The image is corrupt or cannot be safely decoded.', code=400) from exc


def check_quality(image: Image.Image, settings: Settings, crop: bool = False) -> QualityResult:
    gray = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2GRAY)
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(gray.mean())
    reasons = []
    if min(image.size) < (settings.min_crop_side if crop else settings.min_image_side):
        reasons.append('Medicine is too small to read; move closer.')
    if blur < settings.blur_threshold:
        reasons.append('Image is blurred or lacks readable detail.')
    if not settings.brightness_min <= brightness <= settings.brightness_max:
        reasons.append('Image is too dark or overexposed.')
    return QualityResult(usable=not reasons, blur=round(blur, 2), brightness=round(brightness, 2),
                         width=image.width, height=image.height, reasons=reasons)


def crop_image(image: Image.Image, bbox: list[int], settings: Settings):
    x1, y1, x2, y2 = bbox
    px, py = (x2 - x1) * settings.crop_padding, (y2 - y1) * settings.crop_padding
    padded = [max(0, int(x1-px)), max(0, int(y1-py)), min(image.width, int(x2+px)),
              min(image.height, int(y2+py))]
    return image.crop(padded), padded


def encode_crop(image: Image.Image, max_side: int) -> bytes:
    image = image.copy()
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format='JPEG', quality=95)
    return output.getvalue()
