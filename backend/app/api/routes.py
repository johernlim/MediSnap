from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from starlette.concurrency import run_in_threadpool

from ..models.schemas import (HealthResponse, Medicine, MedicineVisualEvidence,
                              RecognitionResponse, SearchResponse, SpokenLanguage)
from ..utils.errors import ProcessingError
from ..utils.image_utils import validate_image

router = APIRouter(prefix='/api')


def services(request: Request):
    return request.app.state.services


@router.get('/health', response_model=HealthResponse)
def health(service=Depends(services)):
    available, count, stamp = service.npra.health()
    healthy = available and service.yolo.loaded and service.vision.configured
    return HealthResponse(status='healthy' if healthy else 'degraded', yolo_loaded=service.yolo.loaded,
        npra_database=available, openai_configured=service.vision.configured, npra_records=count,
        npra_imported_at=stamp, message='Ready.' if healthy else 'Configure missing weights, NPRA data, or OpenAI settings. See README.')


@router.get('/search', response_model=SearchResponse)
def search(q: Annotated[str, Query(min_length=2, max_length=200)],
           limit: Annotated[int, Query(ge=1, le=100)] = 30, service=Depends(services)):
    return service.npra.search(visible_text=[q], limit=limit)


@router.get('/medicine/{medicine_id}', response_model=Medicine)
def medicine(medicine_id: int, service=Depends(services)):
    if not 0 < medicine_id < 2**63:
        raise ProcessingError('Medicine record not found.', code=404)
    record = service.npra.get(medicine_id)
    if record is None:
        raise ProcessingError('Medicine record not found.', code=404)
    return record


@router.post('/recognize', response_model=RecognitionResponse,
             responses={400: {'model': RecognitionResponse}, 413: {'model': RecognitionResponse},
                        415: {'model': RecognitionResponse}, 422: {'model': RecognitionResponse},
                        503: {'model': RecognitionResponse}})
async def recognize(image: Annotated[UploadFile | None, File(description='One JPEG, PNG or WEBP photo')] = None,
                    language: Annotated[SpokenLanguage, Form(description='Language for general-use information')] = 'en',
                    previous_evidence: Annotated[str | None, Form(
                        description='Observed evidence JSON from the first photo in this session')] = None,
                    service=Depends(services)):
    if image is None:
        raise ProcessingError('Please upload an image in the image field.', code=400)
    decoded = None
    try:
        data = await image.read(int(service.settings.max_image_size_mb * 1024 * 1024)+1)
        decoded = await run_in_threadpool(validate_image, data, image.filename, image.content_type, service.settings)
        prior = None
        if previous_evidence:
            if len(previous_evidence) > 20_000:
                raise ProcessingError('Previous photo evidence is too large.', code=400)
            try:
                prior = MedicineVisualEvidence.model_validate_json(previous_evidence)
            except ValueError as exc:
                raise ProcessingError('Previous photo evidence is invalid.', code=400) from exc
        return await run_in_threadpool(service.recognize, decoded, language, prior)
    finally:
        await image.close()
        if decoded is not None:
            decoded.close()
