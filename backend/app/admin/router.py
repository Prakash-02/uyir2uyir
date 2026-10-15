from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import Field

from app.auth.dependencies import (
    Actor,
    require_demo_actor,
    require_staff_or_admin_actor,
)
from app.clock.service import SimulationClock, get_clock
from app.clock.story import run_story
from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import get_store

router = APIRouter(prefix="/admin", tags=["Admin"])


class WeatherSettingRequest(CamelModel):
    on: bool


class ClockAdvanceRequest(CamelModel):
    minutes: int = Field(gt=0)


class AppConfigResponse(CamelModel):
    data_mode: str
    banner_text: str | None
    weather_alert: bool = False


@router.post("/scenario/{scenario_id}/run")
async def run_scenario(
    scenario_id: str,
    background_tasks: BackgroundTasks,
    _actor: Annotated[Actor, Depends(require_demo_actor)],
) -> dict[str, bool]:
    """Runs a demonstration scenario (demo mode only).

    Returns immediately while execution runs as a background task.
    Returns 404 in live mode.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo scenarios are not available in live data mode.",
        )

    # Dispatch demo story in background
    store = get_store()
    clock = get_clock()
    background_tasks.add_task(run_story, store, clock)
    return {"ok": True}


@router.post("/reset")
async def reset_demo(
    _actor: Annotated[Actor, Depends(require_demo_actor)],
) -> dict[str, bool]:
    """Clears and reseeds the demo database and clock (demo mode only).

    Returns 404 in live mode.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo reset is not available in live data mode.",
        )

    store = get_store()
    store.reset()

    from scripts.seed import seed

    await seed()
    SimulationClock.reset_instance()
    return {"ok": True}


@router.post("/clock/advance")
async def advance_clock(
    payload: ClockAdvanceRequest,
    _actor: Annotated[Actor, Depends(require_demo_actor)],
) -> dict[str, bool]:
    """Advances simulated application clock by given minutes (demo mode only).

    Returns 404 in live mode.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clock advancement is not available in live data mode.",
        )

    clock = get_clock()
    if isinstance(clock, SimulationClock):
        clock.advance_seconds(payload.minutes * 60)
        await clock.persist_to_store(get_store())

    return {"ok": True}


@router.post("/settings/weather", response_model=AppConfigResponse)
async def set_weather_alert(
    payload: WeatherSettingRequest,
    _actor: Annotated[Actor, Depends(require_staff_or_admin_actor)],
) -> AppConfigResponse:
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
