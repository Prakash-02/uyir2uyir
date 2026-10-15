from datetime import UTC, datetime

import pytest

from app.clock.service import SimulationClock
from app.core.entities import Donor
from app.core.store_memory import MemoryStore
from app.matching.service import select_donors_for_request
from app.requests.models import (
    BloodGroup,
    BloodRequest,
    Call,
    CallState,
    Component,
    Lang,
    RequestStatus,
)


@pytest.fixture
def memory_store() -> MemoryStore:
    store = MemoryStore.get_instance()
    store.reset()
    return store


@pytest.fixture
def sim_clock() -> SimulationClock:
    return SimulationClock(base_time=datetime(2026, 10, 15, 9, 0, 0, tzinfo=UTC))


def _make_donor(
    donor_id: str,
    blood_group: BloodGroup,
    distance_km: float,
    last_donation: str | None = None,
    consent_urgent: bool = True,
    active: bool = True,
) -> Donor:
    return Donor(
        id=donor_id,
        alias=f"Donor {donor_id.upper()}",
        blood_group=blood_group,
        lang=Lang.EN,
        area="Chennai Central",
        city="Chennai",
        distance_km=distance_km,
        phone_hash=f"hash-{donor_id}",
        phone_masked="+91 ••••• ••000",
        consent_urgent=consent_urgent,
        consent_history=True,
        adult=True,
        active=active,
        last_donation_date=last_donation,
        is_simulated=True,
        data_mode="demo",
    )


async def test_matching_rules(memory_store: MemoryStore, sim_clock: SimulationClock):
    req = BloodRequest(
        id="req-test-1",
        hospital_id="hosp-1",
        hospital_name="Test Hospital",
        centre_id="centre-1",
        centre_name="Test Centre",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at="2026-10-15T09:00:00Z",
        updated_at="2026-10-15T09:00:00Z",
        expires_at="2026-10-16T09:00:00Z",
        is_simulated=True,
    )

    # 1. Incompatible group (B+) -> excluded
    d_incomp = _make_donor("d-incomp", BloodGroup.B_POS, 1.0)
    # 2. No urgent consent -> excluded
    d_no_consent = _make_donor("d-no-consent", BloodGroup.O_POS, 1.1, consent_urgent=False)
    # 3. Inactive / opted out -> excluded
    d_inactive = _make_donor("d-inactive", BloodGroup.O_POS, 1.2, active=False)
    # 4. Spacing < 90 days ago (2026-09-01 vs 2026-10-15 is ~44 days) -> excluded
    d_too_recent = _make_donor("d-recent", BloodGroup.O_POS, 1.3, last_donation="2026-09-01")

    # Eligible donors:
    # d1: 2.0 km, donated 2024-01-01 (longest ago)
    d1 = _make_donor("d1", BloodGroup.O_POS, 2.0, last_donation="2024-01-01")
    # d2: 2.0 km, never donated (None counts as oldest/furthest in past)
    d2 = _make_donor("d2", BloodGroup.O_POS, 2.0, last_donation=None)
    # d3: 1.5 km, donated 2025-01-01 (closer)
    d3 = _make_donor("d3", BloodGroup.O_POS, 1.5, last_donation="2025-01-01")
    # d4: O- is universal donor for RBC -> compatible! 2.5 km
    d4 = _make_donor("d4", BloodGroup.O_NEG, 2.5, last_donation="2025-06-01")
    # d5: 3.0 km
    d5 = _make_donor("d5", BloodGroup.O_POS, 3.0, last_donation="2025-01-01")
    # d6: 4.0 km (would be 6th)
    d6 = _make_donor("d6", BloodGroup.O_POS, 4.0, last_donation="2025-01-01")

    for d in [d_incomp, d_no_consent, d_inactive, d_too_recent, d1, d2, d3, d4, d5, d6]:
        await memory_store.save_donor(d)

    # Already called d3 in a previous round
    already_called = Call(
        id="req-test-1_1_d3",
        request_id="req-test-1",
        donor_alias="Donor D3",
        blood_group=BloodGroup.O_POS,
        lang=Lang.EN,
        state=CallState.DECLINED,
        round=1,
        distance_km=1.5,
        updated_at="2026-10-15T09:00:00Z",
    )
    await memory_store.save_call("req-test-1", already_called)

    matched = await select_donors_for_request(memory_store, req, clock=sim_clock, limit=5)

    # d3 was already called -> must NOT be in matched
    matched_ids = [d.id for d in matched]
    assert "d3" not in matched_ids
    assert "d-incomp" not in matched_ids
    assert "d-no-consent" not in matched_ids
    assert "d-inactive" not in matched_ids
    assert "d-recent" not in matched_ids

    # Expected order:
    # 1. d2 (distance 2.0, never donated None < 2024-01-01)
    # 2. d1 (distance 2.0, donated 2024-01-01)
    # 3. d4 (distance 2.5, O- compatible)
    # 4. d5 (distance 3.0)
    # 5. d6 (distance 4.0)
    assert matched_ids == ["d2", "d1", "d4", "d5", "d6"]
    assert len(matched) == 5
