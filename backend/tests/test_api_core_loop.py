from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.clock.service import SimulationClock
from app.core.config import Settings
from app.core.store_memory import MemoryStore
from app.main import create_app
from app.requests.models import CallState
from scripts.seed import seed


@pytest.fixture(autouse=True)
async def reset_store_and_clock():
    """Resets memory store and seeds fixtures before each test."""
    store = MemoryStore.get_instance()
    store.reset()
    SimulationClock.reset_instance(
        base_time=datetime(2026, 10, 15, 9, 0, 0, tzinfo=UTC),
        offset_seconds=0.0,
    )
    await seed()


@pytest.fixture
def client() -> TestClient:
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
        INTERNAL_TOKEN="test-internal-token",
        REQUEST_CALL_CAP=15,
        DAILY_CALL_CAP=30,
        ALLOW_TEST_HEADER_AUTH=True,
    )
    app = create_app(settings=settings)
    return TestClient(app)


def test_full_demo_story_through_api(client: TestClient):
    """Executes the full demo story through the HTTP API with FastAPI TestClient."""
    # 1. Hospital raises urgent request for 2 units of O+ WHOLE_BLOOD
    resp = client.post(
        "/requests",
        headers={"X-Demo-Role": "hospital", "X-Demo-Hospital-Id": "hosp-sample-1"},
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
            "patientRef": "PATIENT-SECRET-42",
        },
    )
    assert resp.status_code == 201
    req_data = resp.json()
    assert req_data["status"] == "OPEN"
    assert req_data["round"] == 1
    assert req_data["unitsNeeded"] == 2
    assert req_data["accepted"] == 0
    assert req_data["onTheWay"] == 0
    req_id = req_data["id"]

    # 2. Public status endpoint verifies stripped fields (no patientRef, no counts)
    status_resp = client.get(f"/requests/{req_id}/status")
    assert status_resp.status_code == 200
    pub_data = status_resp.json()
    assert pub_data["id"] == req_id
    assert pub_data["status"] == "OPEN"
    assert "patientRef" not in pub_data
    assert "accepted" not in pub_data

    # Verify 5 calls were queued and dialed/ringing in round 1
    store = MemoryStore.get_instance()
    round_1_calls = store._calls.get(req_id, {})
    assert len(round_1_calls) == 5
    for call in round_1_calls.values():
        assert call.state == CallState.RINGING
        assert call.round == 1

    sorted_calls = sorted(round_1_calls.values(), key=lambda c: c.distance_km)
    call_1 = sorted_calls[0]
    call_2 = sorted_calls[1]
    call_3 = sorted_calls[2]
    call_4 = sorted_calls[3]

    # 3. Donor 1 presses 1 (Coming to donate)
    press1_resp = client.post(f"/sim/calls/{call_1.id}/press", json={"key": "1"})
    assert press1_resp.status_code == 200
    assert press1_resp.json()["state"] == "ON_THE_WAY"

    req_after_1 = client.get(f"/requests/{req_id}/status").json()
    assert req_after_1["status"] == "OPEN"

    # 4. Donor 2 presses 1 (Coming to donate) -> covered = 2
    press2_resp = client.post(f"/sim/calls/{call_2.id}/press", json={"key": "1"})
    assert press2_resp.status_code == 200
    assert press2_resp.json()["state"] == "ON_THE_WAY"

    # 5. Donor 3 presses 1 -> covered = 3 >= N+1 (3). Request transitions to PAUSED!
    press3_resp = client.post(f"/sim/calls/{call_3.id}/press", json={"key": "1"})
    assert press3_resp.status_code == 200
    assert press3_resp.json()["state"] == "ON_THE_WAY"

    paused_req = client.get(f"/requests/{req_id}/status").json()
    assert paused_req["status"] == "PAUSED"

    # 6. Donor 4 presses 1 while request is PAUSED -> becomes LATE_ACCEPT
    press4_resp = client.post(f"/sim/calls/{call_4.id}/press", json={"key": "1"})
    assert press4_resp.status_code == 200
    assert press4_resp.json()["state"] == "LATE_ACCEPT"

    # 7. Staff clinically accepts Donor 1 at centre
    accept_1_resp = client.post(
        f"/calls/{call_1.id}/accept",
        headers={"X-Demo-Role": "staff", "X-Demo-Centre-Id": "centre-sample-1"},
    )
    assert accept_1_resp.status_code == 200
    assert accept_1_resp.json()["state"] == "ACCEPTED"

    # Verify donor 1's lastDonationDate was updated
    donor_1_id = call_1.id.split("_")[-1]
    donor_1 = store._donors.get(donor_1_id)
    assert donor_1 is not None
    assert donor_1.last_donation_date == "2026-10-15"

    # 8. Staff clinically accepts Donor 2 -> accepted = 2 == unitsNeeded -> FULFILLED!
    accept_2_resp = client.post(
        f"/calls/{call_2.id}/accept",
        headers={"X-Demo-Role": "staff", "X-Demo-Centre-Id": "centre-sample-1"},
    )
    assert accept_2_resp.status_code == 200
    assert accept_2_resp.json()["state"] == "ACCEPTED"

    fulfilled_req = client.get(f"/requests/{req_id}/status").json()
    assert fulfilled_req["status"] == "FULFILLED"

    # Verify remaining ringing call (call 5) was cancelled when request fulfilled
    call_5 = sorted_calls[4]
    refreshed_call_5 = store._calls[req_id][call_5.id]
    assert refreshed_call_5.state == CallState.CANCELLED


def test_duplicate_press_is_idempotent(client: TestClient):
    """Verifies duplicate key presses return the same call and do not double count."""
    resp = client.post(
        "/requests",
        headers={"X-Demo-Role": "hospital"},
        json={
            "bloodGroup": "O+",
            "component": "RED_CELLS",
            "unitsNeeded": 2,
        },
    )
    req_id = resp.json()["id"]

    store = MemoryStore.get_instance()
    call = next(iter(store._calls[req_id].values()))

    # First press 1
    resp1 = client.post(f"/sim/calls/{call.id}/press", json={"key": "1"})
    assert resp1.status_code == 200
    assert resp1.json()["state"] == "ON_THE_WAY"

    req_after_1 = store._requests[req_id]
    assert req_after_1.on_the_way == 1

    # Second press 1 on same call: idempotent, counts once
    resp2 = client.post(f"/sim/calls/{call.id}/press", json={"key": "1"})
    assert resp2.status_code == 200
    assert resp2.json()["state"] == "ON_THE_WAY"

    req_after_2 = store._requests[req_id]
    assert req_after_2.on_the_way == 1  # Unchanged!


def test_caps_refuse_16th_call(client: TestClient):
    """Verifies that REQUEST_CALL_CAP (15) strictly bounds calls and refuses the 16th call."""
    resp = client.post(
        "/requests",
        headers={"X-Demo-Role": "hospital"},
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
        },
    )
    req_id = resp.json()["id"]
    store = MemoryStore.get_instance()
    sim_clock = SimulationClock.get_instance()

    # Round 1 has 5 calls
    assert len(store._calls[req_id]) == 5

    # Finish round 1 calls by declining
    for c in list(store._calls[req_id].values()):
        client.post(f"/sim/calls/{c.id}/press", json={"key": "2"})

    # Advance clock past lease & tick to open round 2
    from app.core.config import get_settings

    token = get_settings().INTERNAL_TOKEN

    sim_clock.advance_seconds(60)
    tick1 = client.post("/internal/tick", headers={"INTERNAL_TOKEN": token})
    assert tick1.status_code == 200
    assert tick1.json()["roundsOpened"] == 1
    assert len(store._calls[req_id]) == 10  # Round 1 + Round 2

    # Finish round 2 calls
    for c in list(store._calls[req_id].values()):
        if c.round == 2:
            client.post(f"/sim/calls/{c.id}/press", json={"key": "2"})

    # Advance clock & tick to open round 3
    sim_clock.advance_seconds(60)
    tick2 = client.post("/internal/tick", headers={"INTERNAL_TOKEN": token})
    assert tick2.status_code == 200
    assert tick2.json()["roundsOpened"] == 1
    assert len(store._calls[req_id]) == 15  # Total 15 calls reached

    # Finish round 3 calls
    for c in list(store._calls[req_id].values()):
        if c.round == 3:
            client.post(f"/sim/calls/{c.id}/press", json={"key": "2"})

    # Advance clock & tick to attempt round 4
    sim_clock.advance_seconds(60)
    tick3 = client.post("/internal/tick", headers={"INTERNAL_TOKEN": token})
    assert tick3.status_code == 200

    # Total calls MUST NOT exceed REQUEST_CALL_CAP (15)
    assert len(store._calls[req_id]) == 15


def test_second_concurrent_tick_does_nothing(client: TestClient):
    """Verifies that a 50s lease lock in locks/tick causes a concurrent tick to do nothing."""
    from app.core.config import get_settings

    token = get_settings().INTERNAL_TOKEN

    # First tick acquires lease
    resp1 = client.post("/internal/tick", headers={"INTERNAL_TOKEN": token})
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "ok"

    # Second immediate tick (lease still held) skips work
    resp2 = client.post("/internal/tick", headers={"INTERNAL_TOKEN": token})
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "skipped"
    assert resp2.json()["reason"] == "lease_held"


def test_weather_alert_setting_and_config(client: TestClient):
    """Verifies POST /admin/settings/weather updates config/app and GET /config reflects it."""
    # Toggle weather alert on
    set_resp = client.post("/admin/settings/weather", json={"on": True})
    assert set_resp.status_code == 200
    assert set_resp.json()["weatherAlert"] is True

    # GET /config reflects weatherAlert
    conf_resp = client.get("/config")
    assert conf_resp.status_code == 200
    assert conf_resp.json()["weatherAlert"] is True

    # Toggle off
    set_resp_off = client.post("/admin/settings/weather", json={"on": False})
    assert set_resp_off.status_code == 200
    assert set_resp_off.json()["weatherAlert"] is False

    conf_resp_off = client.get("/config")
    assert conf_resp_off.json()["weatherAlert"] is False


def test_internal_tick_auth_required(client: TestClient):
    """Verifies /internal/tick rejects requests with missing or invalid token."""
    resp_no_token = client.post("/internal/tick")
    assert resp_no_token.status_code == 401

    resp_bad_token = client.post("/internal/tick", headers={"INTERNAL_TOKEN": "wrong-secret-token"})
    assert resp_bad_token.status_code == 401
