from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings, set_settings
from app.core.logging import setup_logging, validation_exception_handler
from app.core.mode_guard import verify_mode_guard
from app.core.models import CamelModel


class AppConfigResponse(CamelModel):
    """Configuration shape conforming to docs/API_CONTRACT.md."""

    data_mode: str
    banner_text: str | None
    weather_alert: bool = False


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory for U2U FastAPI backend."""
    if settings is not None:
        set_settings(settings)
    current_settings = settings or get_settings()

    # Verify mode safety before starting
    verify_mode_guard(current_settings)

    # Configure structured JSON logging
    setup_logging()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # Additional async initialization (e.g. clients) can be added here
        yield

    app = FastAPI(
        title="U2U (Uyir2Uyir) API",
        description="Backend API relaying urgent blood requests to nearby donors via automated calls.",
        version="0.1.0",
        lifespan=lifespan,
    )

    # Attach custom exception handler to avoid leaking raw input bodies
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Configure CORS middleware
    origins = current_settings.allowed_origins_list
    if "http://localhost:5173" not in origins:
        origins.append("http://localhost:5173")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health endpoint (/health and /healthz; GFE intercepts /healthz on Cloud Run)
    @app.get("/health", tags=["Health"])
    @app.get("/healthz", tags=["Health"])
    async def healthz():
        return {"status": "ok"}

    # Public config endpoint
    @app.get("/config", response_model=AppConfigResponse, tags=["Configuration"])
    async def get_config():
        from app.core.store import get_store

        store = get_store()
        app_conf = await store.get_config("app") or {}
        weather_alert = bool(app_conf.get("weatherAlert", False))

        banner = (
            "SIMULATED DATA · Demo mode · No real donors or patients"
            if current_settings.DATA_MODE == "demo"
            else None
        )
        return AppConfigResponse(
            data_mode=current_settings.DATA_MODE,
            banner_text=banner,
            weather_alert=weather_alert,
        )

    from app.admin.router import router as admin_router
    from app.ai.tts import router as tts_router
    from app.auth.router import router as auth_router
    from app.clock.router import router as clock_router
    from app.desk.router import desk_router
    from app.donors.router import router as donors_router
    from app.eval.router import router as eval_router
    from app.outreach.router import router as outreach_router
    from app.outreach.twilio_router import router as twilio_router
    from app.requests.router import router as requests_router
    from app.screening.metrics import router as metrics_router
    from app.screening.router import router as screening_router
    from app.voice.twilio_stream import router as voice_stream_router

    app.include_router(auth_router)
    app.include_router(donors_router)
    app.include_router(requests_router)
    app.include_router(outreach_router)
    app.include_router(twilio_router)
    app.include_router(voice_stream_router)
    app.include_router(tts_router)
    app.include_router(screening_router)
    app.include_router(desk_router)
    app.include_router(eval_router)
    app.include_router(metrics_router)
    app.include_router(clock_router)
    app.include_router(admin_router)

    return app


# Root ASGI application instance for Uvicorn
app = create_app()
