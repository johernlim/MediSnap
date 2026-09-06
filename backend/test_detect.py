"""Run the configured detector against one image at several confidence levels.

Uses the app's own YOLOService, so it exercises whichever provider .env selects
(local weights or the Roboflow hosted API) rather than a separate code path.

    python backend/test_detect.py photo.jpg
    python backend/test_detect.py photo.jpg 0.5 0.25 0.1
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from app.config import Settings
from app.services.yolo_service import YOLOService

if len(sys.argv) < 2:
    print(__doc__)
    raise SystemExit(2)

image_path = Path(sys.argv[1])
thresholds = [float(value) for value in sys.argv[2:]] or [0.50, 0.25, 0.10]

if not image_path.exists():
    raise SystemExit(f'No such image: {image_path}')

image = Image.open(image_path).convert('RGB')
print(f'image    : {image_path}  {image.width}x{image.height}')

output_dir = Path('out')
output_dir.mkdir(exist_ok=True)

for threshold in thresholds:
    settings = Settings(yolo_confidence_threshold=threshold)
    service = YOLOService(settings)
    service.load()

    print(f'\nprovider={settings.yolo_provider}  loaded={service.loaded}  conf>={threshold}')

    if not service.loaded:
        print('  detector unavailable - check the weights path or the Roboflow key')
        continue

    try:
        detections = service.detect(image)
    except Exception as exc:
        print(f'  FAILED  {type(exc).__name__}: {exc}')
        service.close()
        continue

    print(f'  {len(detections)} detection(s)')
    for detection in detections:
        print(f'   #{detection.id}  {detection.class_name}  {detection.confidence:.2f}  bbox={detection.bbox}')
        saved = output_dir / f'crop_conf{threshold}_{detection.id}.jpg'
        detection.crop.save(saved)
        print(f'        crop -> {saved}')

    service.close()
