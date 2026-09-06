"""Run from root: python -m uvicorn app.main:app --app-dir backend --port 8000."""
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from .api.routes import router
from .api.upload_limit import UploadLimitMiddleware
from .config import Settings
from .models.schemas import RecognitionResponse
from .services.npra_service import NPRAService
from .services.openai_service import OpenAIService
from .services.recognition_service import RecognitionService
from .services.yolo_service import YOLOService
from .utils.errors import ProcessingError


def create_app(settings: Settings | None = None, service: RecognitionService | None = None) -> FastAPI:
    config = settings or Settings()
    application_logger = logging.getLogger('app')
    application_logger.setLevel(logging.INFO)
    if not application_logger.handlers:
        application_logger.addHandler(logging.StreamHandler())
        application_logger.propagate = False

    @asynccontextmanager
    async def lifespan(application):
        if service is None:
            yolo = YOLOService(config)
            yolo.load()  # Once per worker process, never once per request.
            application.state.services = RecognitionService(config, yolo, OpenAIService(config),
                                                            NPRAService(config.npra_database_path))
        else:
            application.state.services = service
        yield
        if service is None:
            application.state.services.yolo.close()
            application.state.services.vision.close()

    application = FastAPI(title='MediSnap Malaysian Medicine Recognition', version='1.0.0', lifespan=lifespan)
    application.add_middleware(UploadLimitMiddleware, max_bytes=int(config.max_image_size_mb*1024*1024)+65536)
    application.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in config.cors_origins.split(',')],
                               allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])

    @application.exception_handler(ProcessingError)
    async def processing_error(request: Request, exc: ProcessingError):
        return JSONResponse(RecognitionResponse(success=False, status=exc.status,
                            message=exc.message).model_dump(), status_code=exc.code)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(RecognitionResponse(success=False, status='PROCESSING_ERROR',
                            message='Invalid request. Check the image field or search parameters.').model_dump(), status_code=422)

    @application.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return JSONResponse(RecognitionResponse(success=False, status='PROCESSING_ERROR',
                            message='The request could not be accepted. Check its format and endpoint.').model_dump(), status_code=exc.status_code)

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logging.getLogger(__name__).error('request_failed error_type=%s', type(exc).__name__)
        return JSONResponse(RecognitionResponse(success=False, status='PROCESSING_ERROR',
                            message='Processing failed. Please try again later.').model_dump(), status_code=500)

    application.include_router(router)
    return application


app = create_app()
