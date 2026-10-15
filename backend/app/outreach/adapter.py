from typing import Protocol

from app.clock.service import Clock, get_clock
from app.core.store import Store
from app.requests.models import Call, CallState


class TelephonyAdapter(Protocol):
    """Protocol for outbound telephony providers (simulator or Twilio)."""

    async def place_call(self, call: Call) -> None: ...


class SimulatorAdapter:
    """In-memory demo telephony adapter that marks calls as RINGING.

    Twilio adapter will be introduced in Prompt B9.
    """

    def __init__(self, store: Store, clock: Clock | None = None) -> None:
        self._store = store
        self._clock = clock or get_clock()

    async def place_call(self, call: Call) -> None:
        now_iso = self._clock.now_iso()
        ringing_call = call.model_copy(
            update={
                "state": CallState.RINGING,
                "updated_at": now_iso,
            }
        )
        await self._store.save_call(call.request_id, ringing_call)
