from uuid import uuid4

from app.clock.service import Clock, get_clock
from app.core.config import get_settings
from app.core.entities import Donor
from app.core.store import Store, TransactionStore
from app.outreach.adapter import TelephonyAdapter
from app.requests.models import BloodRequest, Call, CallState, TimelineEvent


def build_call_script(request: BloodRequest, donor: Donor, weather_alert: bool = False) -> str:
    """Builds IVR call prompt text including rain warning when weather alert is active."""
    rain_prefix = (
        "Warning: Heavy rain and waterlogging reported across Chennai. "
        "Please travel only if your route is completely safe. "
        if weather_alert
        else ""
    )
    return (
        f"{rain_prefix}U2U urgent blood request: {request.units_needed} units of "
        f"{request.blood_group} {request.component} needed at {request.hospital_name}. "
        "Press 1 to come donate, 2 to decline, or 9 to opt out."
    )


async def dispatch_round_calls(
    store: Store,
    request: BloodRequest,
    donors: list[Donor],
    adapter: TelephonyAdapter,
    clock: Clock | None = None,
) -> list[Call]:
    """Prepares and dispatches outbound calls for a round.

    Rules:
    - Fixed call IDs: f"{requestId}_{round}_{donorId}".
    - Refuses call when DATA_MODE=live and donor isSimulated.
    - Enforces REQUEST_CALL_CAP (default 15) and DAILY_CALL_CAP (default 30).
    - Writes calls as QUEUED in a transaction.
    - AFTER transaction commits: compare-and-set flips QUEUED to DIALING before calling adapter.
    """
    settings = get_settings()
    current_clock = clock or get_clock()
    now_iso = current_clock.now_iso()
    today_str = current_clock.now().date().isoformat()

    # Safety: Refuse calls in live mode if any donor is simulated
    if settings.DATA_MODE == "live":
        for donor in donors:
            if donor.is_simulated:
                raise ValueError(
                    f"Outreach refused: cannot call simulated donor {donor.alias} in live data mode."
                )

    # 1. Enforce REQUEST_CALL_CAP
    existing_calls = await store.list_calls(request.id)
    existing_count = len(existing_calls)
    remaining_for_request = max(0, settings.REQUEST_CALL_CAP - existing_count)

    if remaining_for_request <= 0:
        return []

    # 2. Enforce DAILY_CALL_CAP
    daily_conf = await store.get_config("daily_calls")
    today_calls = 0
    if daily_conf and daily_conf.get("date") == today_str:
        today_calls = int(daily_conf.get("count", 0))

    remaining_for_day = max(0, settings.DAILY_CALL_CAP - today_calls)
    if remaining_for_day <= 0:
        return []

    # Bound donors by available caps
    allowed_count = min(len(donors), remaining_for_request, remaining_for_day)
    eligible_donors = donors[:allowed_count]

    if not eligible_donors:
        return []

    # Build Call models in initial QUEUED state
    queued_calls: list[Call] = []
    for donor in eligible_donors:
        call_id = f"{request.id}_{request.round}_{donor.id}"
        queued_calls.append(
            Call(
                id=call_id,
                request_id=request.id,
                donor_alias=donor.alias,
                blood_group=donor.blood_group,
                lang=donor.lang,
                state=CallState.QUEUED,
                round=request.round,
                eta_minutes=None,
                distance_km=donor.distance_km,
                updated_at=now_iso,
            )
        )

    # Transaction: stage all QUEUED calls, update daily counter, and record event
    async def _tx_save_queued(tx: TransactionStore) -> None:
        for call in queued_calls:
            await tx.save_call(request.id, call)

        new_total = today_calls + len(queued_calls)
        await tx.set_config("daily_calls", {"date": today_str, "count": new_total})

        event = TimelineEvent(
            id=f"evt-{uuid4().hex[:8]}",
            request_id=request.id,
            at=now_iso,
            kind="CALLS_QUEUED",
            text=f"Round {request.round}: Queued {len(queued_calls)} calls.",
        )
        await tx.append_event(request.id, event)

    await store.run_transaction(_tx_save_queued)

    # Dispatch AFTER transaction commits:
    # Compare-and-set QUEUED -> DIALING, then call adapter.place_call
    dispatched_calls: list[Call] = []

    for call in queued_calls:
        current_call = await store.get_call(request.id, call.id)
        if current_call and current_call.state == CallState.QUEUED:
            dialing_call = current_call.model_copy(
                update={
                    "state": CallState.DIALING,
                    "updated_at": current_clock.now_iso(),
                }
            )
            await store.save_call(request.id, dialing_call)
            await adapter.place_call(dialing_call)

            # Re-read to get final state after adapter (e.g. RINGING in simulator)
            placed_call = await store.get_call(request.id, call.id)
            dispatched_calls.append(placed_call or dialing_call)

    return dispatched_calls
