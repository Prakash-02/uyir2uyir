from fastapi import APIRouter

from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import get_store

router = APIRouter(prefix="/admin", tags=["Admin"])


class WeatherSettingRequest(CamelModel):
    on: bool


class AppConfigResponse(CamelModel):
    data_mode: str
    banner_text: str | None
    weather_alert: bool = False


@router.post("/settings/weather", response_model=AppConfigResponse)
async def set_weather_alert(payload: WeatherSettingRequest) -> AppConfigResponse:
    """Toggles weather alert mode (heavy rain/waterlogging).

    When active:
    - Round timeout increases to 5 minutes (300s).
    - Call script includes rain safety advisory.
    """
    settings = get_settings()
    store = get_store()

    # Load or initialize config/app document
    current_conf = await store.get_config("app") or {}
    current_conf["weatherAlert"] = payload.on
    await store.set_config("app", current_conf)

    banner = (
        "SIMULATED DATA · Demo mode · No real donors or patients"
        if settings.DATA_MODE == "demo"
        else None
    )

    return AppConfigResponse(
        data_mode=settings.DATA_MODE,
        banner_text=banner,
        weather_alert=payload.on,
    )
