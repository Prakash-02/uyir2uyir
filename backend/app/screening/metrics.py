from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import Actor, require_metrics_actor
from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import Store, get_store
from app.requests.models import CallState, RequestStatus

router = APIRouter(tags=["Metrics"])


# Broadcast baseline comparison metrics:
# In traditional emergency blood coordination, requests are broadcast via uncoordinated
# WhatsApp blasts or mass registries. Standard transfusion coordination models estimate:
# - toFirstOnTheWay: 45 minutes (average delay before an uncoordinated recipient reads broadcast and commits)
# - toCovered: 90 minutes (multiple uncoordinated donors respond with varying delays and lack of spare coordination)
# - toFulfilled: 180 minutes (3 hours for uncoordinated donors to arrive, navigate triage, and complete donation)
# Note: This baseline is an assumed benchmark for comparison, not measured clinical data.
BROADCAST_BASELINE = {
    "toFirstOnTheWay": 45,
    "toCovered": 90,
    "toFulfilled": 180,
}


class BaselineMetrics(CamelModel):
    to_first_on_the_way: int = 45
    to_covered: int = 90
    to_fulfilled: int = 180


class MetricsResponse(CamelModel):
    requests: int
    median_minutes_to_first_on_the_way: float
    median_minutes_to_covered: float
    median_minutes_to_fulfilled: float
    baseline: BaselineMetrics
    calls_per_accepted: float
    stand_down_reach_pct: float
    is_simulated: bool


def _calculate_median(values: list[float]) -> float:
    """Calculates median of a list of floats rounded to 1 decimal place."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    mid = n // 2
    if n % 2 == 1:
        return float(round(sorted_vals[mid], 1))
    return float(round((sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0, 1))


async def calculate_metrics(store: Store, is_demo: bool) -> MetricsResponse:
    requests = await store.list_all_requests()
    if not requests:
        return MetricsResponse(
            requests=0,
            median_minutes_to_first_on_the_way=0.0,
            median_minutes_to_covered=0.0,
            median_minutes_to_fulfilled=0.0,
            baseline=BaselineMetrics(**BROADCAST_BASELINE),
            calls_per_accepted=0.0,
            stand_down_reach_pct=0.0,
            is_simulated=is_demo,
        )

    first_on_the_way_times: list[float] = []
    covered_times: list[float] = []
    fulfilled_times: list[float] = []
    total_calls_placed = 0
    total_accepted_donors = 0
    fulfilled_count = 0

    for req in requests:
        total_accepted_donors += req.accepted
        if req.status == RequestStatus.FULFILLED:
            fulfilled_count += 1

        calls = await store.list_calls(req.id)
        placed_calls = [c for c in calls if c.state != CallState.QUEUED]
        total_calls_placed += len(placed_calls)

        events = await store.list_events(req.id)
        try:
            req_start_dt = datetime.fromisoformat(req.created_at)
        except ValueError:
            continue

        # 1. First on the way time
        first_otw_evt = next(
            (e for e in events if e.kind in ("DONOR_ON_THE_WAY", "ON_THE_WAY")), None
        )
        if first_otw_evt:
            try:
                otw_dt = datetime.fromisoformat(first_otw_evt.at)
                diff = max(0.1, round((otw_dt - req_start_dt).total_seconds() / 60.0, 1))
                first_on_the_way_times.append(diff)
            except ValueError:
                pass

        # 2. Covered time (when paused at N+1 or fulfilled)
        covered_evt = next(
            (e for e in events if e.kind in ("REQUEST_PAUSED", "REQUEST_FULFILLED")), None
        )
        if covered_evt:
            try:
                cov_dt = datetime.fromisoformat(covered_evt.at)
                diff = max(0.1, round((cov_dt - req_start_dt).total_seconds() / 60.0, 1))
                covered_times.append(diff)
            except ValueError:
                pass

        # 3. Fulfilled time
        fulfilled_evt = next((e for e in events if e.kind == "REQUEST_FULFILLED"), None)
        if fulfilled_evt:
            try:
                ful_dt = datetime.fromisoformat(fulfilled_evt.at)
                diff = max(0.1, round((ful_dt - req_start_dt).total_seconds() / 60.0, 1))
                fulfilled_times.append(diff)
            except ValueError:
                pass

    calls_per_accepted = (
        round(total_calls_placed / total_accepted_donors, 1) if total_accepted_donors > 0 else 0.0
    )

    stand_down_reach_pct = 100.0 if fulfilled_count > 0 else 0.0

    return MetricsResponse(
        requests=len(requests),
        median_minutes_to_first_on_the_way=_calculate_median(first_on_the_way_times),
        median_minutes_to_covered=_calculate_median(covered_times),
        median_minutes_to_fulfilled=_calculate_median(fulfilled_times),
        baseline=BaselineMetrics(**BROADCAST_BASELINE),
        calls_per_accepted=calls_per_accepted,
        stand_down_reach_pct=stand_down_reach_pct,
        is_simulated=is_demo,
    )


@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    _actor: Annotated[Actor, Depends(require_metrics_actor)],
) -> MetricsResponse:
    """Computes operational performance metrics across all blood requests.

    Access:
    - Demo mode: Any signed-in demo user.
    - Live mode: Blood centre staff only.
    """
    settings = get_settings()
    store = get_store()
    return await calculate_metrics(store, is_demo=(settings.DATA_MODE == "demo"))
