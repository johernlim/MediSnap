# MediSnap Malaysian medicine recognition

The existing Expo / React Native app now calls a modular FastAPI recognition service.
The existing Express/Gemini chatbot remains separate. The identification service no
longer returns filename-based sample predictions.

```text
Upload / camera → validate and orient → YOLO26 Pills → independent padded crops
→ image quality → OpenAI visible evidence → NPRA SQLite → deterministic matching
→ concise result → optional back-foil/box photo → merged evidence → final match
```

**YOLO detects. OpenAI extracts observations. NPRA supplies Malaysian product
information. The matcher ranks candidates and can reject identification.**
No training, custom medicine classes, hard-coded medicine list or training dataset
is required.

## Verification and remaining setup

- Official CSV imported: **28,172 products**, 28,243 source rows, 71 repeated
  registrations consolidated, **0 malformed rows skipped**.
- FastAPI starts and its live health/search endpoints work against that database.
- **97 backend tests and 18 recognition/UI transport tests pass.** Backend tests cover validation,
  crops, detector adaptation, structured output, imports/search, scoring, failure
  paths and a pipeline integration test.
- Edited frontend files pass ESLint; TypeScript passes. Expo web export succeeds
  with 18 routes including AI identification. Browser access reaches the existing
  Firebase login gate; signed-in camera/history interaction remains unverified.
- The selected version-12 detector credentials, OpenAI key and OpenAI model are **not configured**.
  Health correctly reports degraded. Live hosted detector inference, a paid Vision call,
  and real-image identification accuracy are **not verified**.
- Tests use controlled detector/vision responses and synthetic fixtures. Their
  pass rate is software validation, not medicine-recognition accuracy.

## Installation

From the repository root in PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements-dev.txt
npm ci
```

Use `backend/requirements.txt` for runtime-only dependencies. Python 3.11+ is
intended; this checkout was installed and tested on Python 3.14. The Python 3.11
NumPy range accommodates older Python support and was not separately tested.
The Python environment is already installed locally in `.venv`.

Stack: FastAPI, Uvicorn, Ultralytics, OpenAI Python SDK, Pydantic/settings,
python-dotenv, Pillow, OpenCV, NumPy, Pandas, SQLite/FTS5, and the existing Expo app.

## Backend configuration

If `backend/.env` is absent, copy `backend/.env.example`. If it already contains
chatbot settings, **append recognition settings without overwriting credentials**.
Paths are relative to `backend/`, independent of the current working directory.

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=your-available-vision-and-structured-output-model
YOLO_MODEL_PATH=models/yolo26_pills.pt
NPRA_DATABASE_PATH=data/npra/medicines.db
```

Select an API model available to your project that accepts image input and strict
structured output. The SDK integration uses
`client.responses.parse(..., text_format=MedicineVisualEvidence)`, a base64 crop,
and `store=False`. See [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
and [image input](https://developers.openai.com/api/docs/guides/images-vision).
The model is explicitly configurable; no credentials were created or added.

**OPENAI_API_KEY exists only on the backend.** Never put it in Expo public
environment variables, HTML, JavaScript, logs or API responses.

| Setting | Default / purpose |
| --- | --- |
| YOLO_CONFIDENCE_THRESHOLD / YOLO_IOU_THRESHOLD | 0.50 / 0.45 |
| YOLO_DEVICE / MAX_DETECTIONS | cpu / 12; too many detections asks for fewer pills |
| YOLO_PROVIDER | local, or roboflow for the hosted model |
| ROBOFLOW_MODEL_ID | pinned to pills-kxe6h-afvos/12 |
| MAX_IMAGE_SIZE_MB / MAX_IMAGE_PIXELS | 10 MB / 20 million pixels |
| MIN_IMAGE_SIDE / MIN_CROP_SIDE | 64 / 48 pixels |
| CROP_PADDING / CROP_MAX_SIDE | 0.08 / 1536 pixels |
| BLUR_THRESHOLD | Laplacian variance 8; heuristic, not measured readability |
| BRIGHTNESS_MIN / BRIGHTNESS_MAX | 15 / 245 on grayscale 0–255 |
| OPENAI_TIMEOUT_SECONDS | 45 per attempt; one retry for invalid structured output |
| MATCH_HIGH_THRESHOLD / MATCH_MEDIUM_THRESHOLD / MATCH_LOW_THRESHOLD | 90 / 70 / 50 |
| MATCH_MARGIN | 15 points minimum separation |
| CANDIDATE_LIMIT | 500; truncated retrieval cannot confirm a match |
| WEIGHT_IMPRINT / WEIGHT_PRODUCT / WEIGHT_MANUFACTURER | 40 / 25 / 15 |
| WEIGHT_STRENGTH / WEIGHT_FORM / WEIGHT_APPEARANCE | 10 / 5 / 5 |
| CORS_ORIGINS | http://localhost:8081,http://127.0.0.1:8081 |

Weights must total 100 and thresholds must be ordered. Invalid settings fail at
startup. The complete environment template is `backend/.env.example`.

## Selected YOLO26 Pills setup

Required source: [Pills version 12](https://universe.roboflow.com/sandy-kyogt/pills-kxe6h-afvos/model/12).

The public deployment screen currently offers the hosted API. This is the practical
setup for this checkout:

1. In Roboflow, get your private API key from account/workspace settings. Do not paste
   it into chat, source code, frontend environment variables, or screenshots.
2. Add these values to `backend/.env`:

   ```dotenv
   YOLO_PROVIDER=roboflow
   ROBOFLOW_API_KEY=your_private_roboflow_key
   ROBOFLOW_MODEL_ID=pills-kxe6h-afvos/12
   ROBOFLOW_API_URL=https://serverless.roboflow.com
   ```

3. Restart FastAPI and check `/api/health`. The backend sends a resized image to
   Roboflow for detection, with the key in an Authorization header and active-learning
   collection disabled. Crops then continue through OpenAI and local NPRA matching.

The hosted adapter uses the documented HTTP endpoint directly because Roboflow's
current `inference-sdk` does not support the Python 3.14 runtime used in this checkout.
No Roboflow key is returned or logged. Hosted inference requires Internet access and
may be subject to Roboflow usage limits and data handling.

If you later obtain raw local weights instead, use the following local setup:

1. Sign into Roboflow and open that exact version.
2. Use **Download Weights** if the owner's permissions and your plan permit it.
3. Put its compatible Ultralytics PyTorch export at `backend/models/yolo26_pills.pt`.
4. Alternatively set YOLO_MODEL_PATH to the actual export path and restart FastAPI.
5. Check health, then test a verified image.

Roboflow documents access restrictions in its
[weights guide](https://docs.roboflow.com/deploy/download-roboflow-model-weights).
A downloadable checkpoint was not available during implementation. If unavailable,
obtain the exact export from its owner. **Dataset export is not model weights.
Do not train or substitute a generic checkpoint such as yolo26n.pt.**

Compatible ONNX exports use the same adapter with the actual .onnx path and
`pip install onnxruntime`. Other Ultralytics export formats may need their runtime
dependencies. The selected version's actual architecture and export format cannot
be certified until its weights are supplied. Incompatible exports stay unavailable;
renaming an incompatible file is not conversion. See `backend/models/README.md`.

The model loads once per worker at startup; inference around that instance is
serialized. There is no fallback model download. Reported model class names are
detector labels, never authoritative product identities.

## NPRA download, mapping and import

Source: [Approved Pharmaceutical Products, NPRA / Ministry of Health Malaysia](https://data.gov.my/data-catalogue/pharmaceutical_products).
This is a daily static snapshot, not live registration verification. The downloaded
catalogue snapshot was labelled data as of 4 September 2026.

From the repository root:

```powershell
python scripts/import_npra.py --download
```

The official CSV goes to `backend/data/npra/pharmaceutical_products.csv` and the
SQLite database to `backend/data/npra/medicines.db` (or NPRA_DATABASE_PATH).
Both already exist locally and are gitignored.

Manual alternative:

1. Download CSV from the catalogue or [official CSV](https://storage.data.gov.my/healthcare/pharmaceutical_products.csv).
2. Save it as `backend/data/npra/pharmaceutical_products.csv`.
3. Run `python scripts/import_npra.py`.
4. Review the printed columns, mapping, imported/skipped counts and malformed rows.
5. Check the count and import timestamp in `/api/health`.

Custom paths: `python scripts/import_npra.py --source path/to/file.csv --database path/to/medicines.db`.

| Actual CSV column | Application field |
| --- | --- |
| reg_no / product | registration_number / product_name |
| status / description | registration_status / description |
| manufacturer / holder | unchanged |
| date_reg / date_end | registration_date / expiry_date |
| active_ingredient / generic_name | unchanged |

Reference number, OSA codes, importer and MDC code remain in raw `source_rows`.
There are no dedicated imprint, color, shape, strength or dosage-form columns:
these remain **null**. Description is a regulatory category, not dosage form.
Ingredients retain the source syntax.

Repeated registrations are consolidated. All source rows are retained, including
multiple manufacturer alternatives. Conflicting product records abort instead of
arbitrarily choosing one. Structural CSV errors, absent required headers and empty
valid data fail loudly. Missing required row values are reported by row number.
Atomic snapshot replacement preserves the old database when import fails. Stable
JavaScript-safe product IDs survive repeat imports; duplicates do not accumulate.

Normalized indexes and FTS5 support case/spacing/punctuation handling and prefix
candidate retrieval. Search is intentionally broad; a partial word can retrieve a
candidate without earning exact-match points. No first-result auto-selection occurs.
Source URL, columns, SHA-256 and import timestamp are recorded in SQLite.

## Evidence scoring and rejection

| Evidence | Points |
| --- | --- |
| Exact authoritative imprint OR exact printed NPRA registration | 40 in one identity slot |
| Visible product/brand text | 25 |
| Exact visible manufacturer / one source-listed alternative | 15 |
| Explicit visible strength matching source text | 10 |
| Visible dosage form matching source text | 5 |
| Color and shape with authoritative candidate appearance data | 5 |

NPRA currently cannot verify tablet imprints. For example, FENO can retrieve
FENO-related products for an ingredient-level preliminary result, but it earns no
product-name or verified-imprint points. Exact copies of an imprint in the visual
text or brand fields are also excluded from product scoring. Printed registration
numbers use the identity slot for packaging. No medicine name is hard-coded in the
runtime pipeline.

Strength and form may be compared against explicit text in the NPRA product name;
reasons identify that source. This neither populates absent official fields nor
claims the database value was observed in the image. Unknown strength earns no points.

Levels: HIGH ≥90, MEDIUM ≥70, LOW ≥50, UNKNOWN below 50. MATCH_FOUND additionally
requires a strong identity anchor, clear text, no known conflict, and sufficient
separation from alternatives. Conflicting brand, registration, manufacturer,
ingredient, strength or form prevents selecting that candidate. Missing fields do
not cause scores to be normalized upward.

Detection confidence is separate from identification confidence (score/100).
Scores are **application heuristics, not medical probabilities**.

If the configured 11-class detector returns no boxes for an otherwise usable
photo, the backend performs one explicitly labelled full-image visual-evidence
pass. This prevents a detector miss from hiding readable text while avoiding a
false YOLO confidence claim. NPRA matching and the same conservative decision
rules still apply.

When several NPRA candidates share one active ingredient, the first result shows
only the possible ingredient-level medicine name, short common uses, and a notice
that dosage cannot yet be verified. Detector details, extracted fields, heuristic
scores, registration details, and candidate lists remain internal. The user can
finish or add an optional second photo of the printed back foil or box. That second
request combines the first photo's observed evidence with the new packaging evidence
and repeats matching. The photos are not stored by this flow.

If no shared NPRA ingredient can be established, an optional model-knowledge
suggestion can still provide one possible medicine name and short general uses. It
is presented as unconfirmed. A possible strength is shown when available. General
dosage guidance is requested only when clear packaging text directly contains both
the suggested full product name and strength; it is labelled unverified and requires
confirmation against the original box/leaflet or by a pharmacist. Pill-only guesses
never receive dosage information, and numeric child dosing is prohibited.

Each newly created account selects an application language immediately after
signup. Returning logins skip language onboarding. The choice is saved in the
Firebase `users/{uid}` profile and cached both per account
and as the last-used device language, so authentication screens are localized
before the user ID is known. Changing it in Settings updates the application UI,
recognition text, speech, and chatbot language. Recognition and chatbot requests
send `en`, `ms`, or `zh`, producing English, Bahasa Melayu, or Simplified Chinese.
When no MediSnap language has ever been selected, the app maps the device locale
to English, Bahasa Melayu, or Simplified Chinese. A later MediSnap selection
overrides the device locale on future launches.

Settings also provides Light and Dark appearance choices. The selection updates
navigation, screens, cards, forms, inputs, dialogs, and result views immediately,
and is stored as `preferred_theme` in `users/{uid}` plus a device cache so the
saved appearance is applied during startup.
`expo-speech` reads the result on iOS and Android automatically when recognition finishes, with replay and stop controls.
On a physical iPhone, silent mode must be off for Expo speech to produce sound.
Medicine names and NPRA data are not translated.

For one NPRA-supported product match, the same bounded OpenAI guidance call returns
short general-use information plus separate general adult and child dosage text.
It never uses profile data or calculates a personalized child dose. No dosage is
shown for an unverified AI identity suggestion. Every visible and spoken dosage
result states that detailed instructions must come from the product box or patient
leaflet, a doctor, or a pharmacist; the imported NPRA dataset itself has no
authoritative dosing field.

All states are supported: MATCH_FOUND, LOW_CONFIDENCE, AMBIGUOUS, UNKNOWN,
NO_MEDICINE_DETECTED, IMAGE_TOO_POOR, PROCESSING_ERROR. Insufficient evidence leaves
`medicine` null and the mobile screen asks for packaging or pharmacist help without
displaying candidate records. Appearance alone cannot identify a pill.

## Start backend and frontend

Backend from the **repository root**, with the virtual environment active:

```powershell
python -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Equivalent from `backend/`: `python -m uvicorn app.main:app --reload --port 8000`.
Missing model/data/OpenAI settings give degraded health so diagnostics remain usable.

Add this to root `.env.local` (already added locally):

```dotenv
EXPO_PUBLIC_RECOGNITION_API_URL=http://localhost:8000
```

From the repository root:

```powershell
npm run web
```

Open [MediSnap](http://localhost:8081), sign into the existing Firebase app, and open
AI Medicine Identification. The existing route protection remains intact. Upload
JPEG/PNG/WEBP, preview the image and press Identify Medicine. Camera uses Expo
ImagePicker where supported; browser/device permissions and a secure context apply.

For a physical phone, configure a reachable LAN backend address, bind Uvicorn to
the needed interface and set the actual web CORS origin where applicable. Restart
Expo after environment changes. Existing chatbot startup remains `npm run dev`
from `backend/`, port 3001, using EXPO_PUBLIC_MEDISNAP_API_URL.

## API usage

[Swagger](http://localhost:8000/docs) and [ReDoc](http://localhost:8000/redoc) expose
the Pydantic request/response contracts.

| Endpoint | Behavior |
| --- | --- |
| POST /api/recognize | multipart `image`, optional `language`, and optional first-photo `previous_evidence` JSON |
| GET /api/search?q=FENO&limit=30 | local candidates and truncation flag |
| GET /api/medicine/{id} | NPRA record or 404 |
| GET /api/health | readiness, count and import time; no secrets |

```powershell
curl.exe -F "image=@C:/photos/medicine.jpg" -F "language=ms" http://localhost:8000/api/recognize
curl.exe "http://localhost:8000/api/search?q=FENO"
```

Validation errors use 400/413/415/422; unavailable dependencies use controlled
503 errors. Per-crop failures stay in the response so other results are preserved.
Always inspect each detection's status, including when HTTP status is 200.

## Testing and evaluation

```powershell
python -m pytest -q
node --test tests/recognition-ui.test.cjs
npx eslint app/ai-identification.jsx components/AIIdentificationForm.js components/MedicineRecognitionResult.js services/aiIdentificationService.js
npx tsc --noEmit
npx expo export --platform web --output-dir dist
```

Tests use explicitly synthetic records, never application seeds or training data.
The integration test exercises real decoding, YOLO output adaptation, cropping,
SQLite and matching, with controlled detector/vision outputs. UI tests render the
real result component with native host shims and verify multipart transport. They
do not claim signed-in browser, native camera, or live model validation.

Actual evaluation uses a small independently verified image set:

```powershell
python scripts/evaluate.py --manifest evaluation/verified.json
```

Requires a healthy backend. This sends useful crops to OpenAI and incurs normal API
usage. Example manifest structure, with placeholders to replace by verified labels:

```json
[
  {
    "image": "image-01.jpg",
    "medicines": [
      {
        "bbox": [10, 20, 180, 150],
        "registration_number": null,
        "imprint": null,
        "visible_text": []
      }
    ]
  }
]
```

Null registration means identity unknown. Label every medicine in each evaluation
image; boxes use oriented-image coordinates. These labels are for optional
evaluation only, never required for normal use or training.

Reports cover localization precision/recall at IoU .50, exact text/imprint
extraction, structured-output success, correct/false identification, ambiguity/
unknown rates, missed detections and processing time. False identities on
unmatched detections or unknown medicines count as failures. Null metrics mean
insufficient measurements, not zero error.

Optional detector benchmark:

```powershell
python scripts/evaluate.py --yolo-data path/to/held-out.yaml
```

This calls Ultralytics validation only for precision, recall, mAP@50, mAP@50–95
and inference time. It needs an appropriately labelled held-out detection set.
**YOLO mAP is not medicine identification accuracy.** No real-image evaluation
metrics are claimed without selected weights, credentials and verified images.
Fine-tuning is a separate future phase only if measured detection failures justify it.

## Privacy, security and limitations

Uploads are checked by extension, MIME, decoded format, byte/pixel bounds, dimensions
and corruption. Orientation is corrected; metadata removed; animation rejected.
Request bytes are bounded before multipart spooling. Upload spools close in finally
blocks, decoded images and crops are closed, and no permanent image storage or
result cache is created. No image-serving endpoint exists.

Useful crops go to OpenAI; no detection, poor quality or unavailable NPRA data
prevents paid analysis. No complete original is sent when a useful crop exists.
`store=False` is not a promise of zero provider retention; review your organization's
actual OpenAI data controls. Logs contain error types, stages, timing, counts and
states, never keys, raw images or extracted personal text.

Save text summary to history is optional: it writes status/product text, user ID
and timestamp to the existing Firebase collection. No photo URI/bytes are saved.
Earlier history remains readable and is marked legacy/unverified; existing records
are not deleted. Firebase rules remain the existing project's responsibility.

The FastAPI service is a **local development API without authentication**. Frontend
Firebase login does not authenticate this separate API. Before public deployment,
add backend authentication, quotas, HTTPS and operational controls. The pipeline
caps concurrency at two jobs per worker and serializes detector inference.

NPRA describes products, not all pill appearances. Bare pills often remain UNKNOWN
or AMBIGUOUS. Packaging works only where the selected detector supports it; there is
no whole-image Vision fallback for undetected packaging. Blur/readability thresholds,
OCR and the matching weights are uncalibrated heuristics. High YOLO confidence,
database existence, color or shape do not establish medicine identity.

This is a **medicine identification aid, not a diagnostic system**, prescription or
substitute for official instructions. Always verify the medicine and its packaging
with a pharmacist, doctor or the original prescription before taking it. The app
does not establish that a medicine is safe for a particular person.

## Files and licensing

New backend: `backend/app/{api,models,database,services,utils}`, `config.py`,
requirements and environment template. CLIs: `scripts/import_npra.py` and
`scripts/evaluate.py`. Tests: `tests/`. New UI: `MedicineRecognitionResult.js`.
Modified: existing identification screen, form, service, README and
gitignore. Existing chatbot, medications and reminders were retained.

NPRA data is attributed to NPRA / Ministry of Health Malaysia through data.gov.my,
whose catalogue offers it under **CC BY 4.0**. Source provenance is recorded in the
database. No real records or model weights are hard-coded into application files.
Weights are not redistributed. Review the selected model/dataset owner's license
and [Ultralytics licensing](https://www.ultralytics.com/license) before deployment.
OpenAI and Firebase remain subject to their service terms. This work does not
change ownership/licensing of the existing project or assets.
