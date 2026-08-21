import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import get_settings
from app.core.errors import ConflictError, DomainError, ForbiddenError, NotFoundError, ServiceUnavailableError
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()
    app = FastAPI(title=settings.app_name, version="0.1.0")
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["GET", "POST"], allow_headers=["Authorization", "Content-Type"])
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(api_router, prefix="/api")
    app.include_router(api_router)

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, error: DomainError) -> JSONResponse:
        status_code = 400
        if isinstance(error, NotFoundError):
            status_code = 404
        elif isinstance(error, (ForbiddenError,)):
            status_code = 403
        elif isinstance(error, ConflictError):
            status_code = 409
        elif isinstance(error, ServiceUnavailableError):
            status_code = 503
        logging.getLogger(__name__).info("domain_error path=%s type=%s", request.url.path, type(error).__name__)
        return JSONResponse(status_code=status_code, content={"detail": str(error)})

    return app


app = create_app()
