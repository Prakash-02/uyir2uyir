from datetime import UTC, datetime, timedelta
from typing import Protocol

from app.core.config import get_settings
from app.core.store import Store


class Clock(Protocol):
    """Abstract clock interface providing timestamps for application time."""

    def now(self) -> datetime: ...

    def now_iso(self) -> str: ...


class RealClock:
    """Production wall-clock returning true UTC time."""

    def now(self) -> datetime:
        return datetime.now(UTC)

    def now_iso(self) -> str:
        return self.now().isoformat()


class SimulationClock:
    """Deterministic simulation clock for testing and demo playback."""

    _instance: "SimulationClock | None" = None

    def __init__(
        self,
        base_time: datetime | None = None,
        offset_seconds: float = 0.0,
    ) -> None:
        self._base_time = base_time or datetime(2026, 10, 15, 9, 0, 0, tzinfo=UTC)
        self._offset_seconds = offset_seconds

    @classmethod
    def get_instance(cls) -> "SimulationClock":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @classmethod
    def reset_instance(
        cls, base_time: datetime | None = None, offset_seconds: float = 0.0
    ) -> "SimulationClock":
        cls._instance = cls(base_time=base_time, offset_seconds=offset_seconds)
        return cls._instance

    def advance_seconds(self, seconds: float) -> datetime:
        self._offset_seconds += seconds
        return self.now()

    def set_time(self, dt: datetime) -> None:
        self._base_time = dt
        self._offset_seconds = 0.0

    def get_offset_seconds(self) -> float:
        return self._offset_seconds

    def now(self) -> datetime:
        return self._base_time + timedelta(seconds=self._offset_seconds)

    def now_iso(self) -> str:
        return self.now().isoformat()

    async def sync_with_store(self, store: Store) -> None:
        """Loads clock state from config/clock if available in store."""
        clock_conf = await store.get_config("clock")
        if clock_conf:
            offset = clock_conf.get("offsetSeconds", 0.0)
            self._offset_seconds = float(offset)

    async def persist_to_store(self, store: Store) -> None:
        """Persists clock state to config/clock in store."""
        await store.set_config(
            "clock",
            {
                "offsetSeconds": self._offset_seconds,
                "simulatedNow": self.now_iso(),
            },
        )


def get_clock() -> Clock:
    """Returns the active clock implementation based on DATA_MODE setting."""
    settings = get_settings()
    if settings.DATA_MODE == "demo":
        return SimulationClock.get_instance()
    return RealClock()
