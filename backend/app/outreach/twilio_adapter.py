"""Twilio voice telephony adapter for real outbound phone calls.

Safety Guarantees:
- Only dials phone numbers explicitly permitted in CALL_ALLOWLIST.
- Reads phone number from vault only at dial time; never stores or logs plaintext phone.
- Configures outbound call with timeout=25, time_limit=90, record=False.
- Tracks consecutive errors; after 3 consecutive failures, switches telephony
  adapter back to simulator and appends a TELEPHONY_FALLBACK timeline event.
"""

import logging
from typing import Any
from uuid import uuid4

from app.clock.service import Clock, get_clock
from app.core.config import get_settings
from app.core.phone_vault import decrypt_phone
from app.core.store import Store
from app.outreach.adapter import SimulatorAdapter, TelephonyAdapter
from app.requests.models import Call, CallState, TimelineEvent

logger = logging.getLogger("u2u.outreach.twilio")


class TwilioAdapter(TelephonyAdapter):
    """Outbound telephony adapter using Twilio Voice REST API."""

    def __init__(
        self,
        store: Store,
        clock: Clock | None = None,
        twilio_client: Any | None = None,
    ) -> None:
        self._store = store
        self._clock = clock or get_clock()
        self._twilio_client = twilio_client

    async def _record_success(self) -> None:
        """Resets consecutive error counter on successful call initiation."""
        conf = await self._store.get_config("telephony") or {}
        if conf.get("consecutiveErrors", 0) != 0:
            conf["consecutiveErrors"] = 0
            await self._store.set_config("telephony", conf)

    async def _record_error(self, call: Call, error: Exception) -> int:
        """Increments consecutive error counter; switches to simulator upon reaching 3."""
        conf = await self._store.get_config("telephony") or {}
        consecutive = int(conf.get("consecutiveErrors", 0)) + 1
        conf["consecutiveErrors"] = consecutive
        conf["lastError"] = str(error)
        now_iso = self._clock.now_iso()
        conf["updatedAt"] = now_iso

        if consecutive >= 3:
            logger.warning(
                "Twilio error threshold reached (3 consecutive errors). Switching to simulator."
            )
            conf["adapter"] = "simulator"
            await self._store.set_config("telephony", conf)

            fallback_event = TimelineEvent(
                id=f"evt-{uuid4().hex[:8]}",
                request_id=call.request_id,
                at=now_iso,
                kind="TELEPHONY_FALLBACK",
                text="3 consecutive Twilio errors encountered. Telephony adapter switched back to simulator.",
            )
            await self._store.append_event(call.request_id, fallback_event)
        else:
            await self._store.set_config("telephony", conf)

        return consecutive

    async def place_call(self, call: Call) -> None:
        """Places an outbound voice call via Twilio to an allowlisted donor number."""
        settings = get_settings()

        # Parse donorId from call.id: requestId_round_donorId
        parts = call.id.split("_", 2)
        if len(parts) < 3:
            raise ValueError(f"Malformed call ID: '{call.id}'. Expected requestId_round_donorId.")
        donor_id = parts[2]

        # 1. Read phone number from vault only at dial time
        contact = await self._store.get_donor_contact(donor_id)
        if not contact or not contact.get("encryptedPhone"):
            err = ValueError(f"No phone contact found in vault for donor {donor_id}")
            await self._record_error(call, err)
            raise err

        try:
            phone = decrypt_phone(contact["encryptedPhone"])
        except Exception as e:
            await self._record_error(call, e)
            raise

        # 2. Refuse any number not in CALL_ALLOWLIST
        if phone not in settings.call_allowlist_set:
            logger.warning(
                "Twilio outbound call refused for donor %s: number not in CALL_ALLOWLIST.",
                call.donor_alias,
            )
            raise ValueError(
                f"Call refused: phone number for donor {call.donor_alias} is not in CALL_ALLOWLIST."
            )

        # 3. Build callback URLs
        base_url = settings.PUBLIC_BASE_URL.rstrip("/")
        mode = settings.DATA_MODE
        voice_url = f"{base_url}/twilio/{mode}/voice/{call.id}"
        status_url = f"{base_url}/twilio/{mode}/status/{call.id}"

        # 4. Initiate Twilio call
        try:
            client = self._twilio_client
            if client is None:
                from twilio.rest import Client

                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

            client.calls.create(
                to=phone,
                from_=settings.TWILIO_FROM_NUMBER,
                url=voice_url,
                status_callback=status_url,
                status_callback_event=["completed", "busy", "no-answer", "failed"],
                timeout=25,
                time_limit=90,
                record=False,
            )
            await self._record_success()
        except Exception as e:
            logger.error("Twilio call placement error for call %s: %s", call.id, e)
            consecutive = await self._record_error(call, e)
            if consecutive >= 3:
                # Switch to simulator and place call so round does not stall
                sim = SimulatorAdapter(self._store, self._clock)
                await sim.place_call(call)
                return
            raise

        # 5. Mark call as RINGING
        now_iso = self._clock.now_iso()
        ringing_call = call.model_copy(
            update={
                "state": CallState.RINGING,
                "updated_at": now_iso,
            }
        )
        await self._store.save_call(call.request_id, ringing_call)
