from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import Actor, get_actor
from app.clock.service import SimulationClock
from app.clock.story import run_story
from app.core.config import Settings, set_settings
from app.core.store_memory import MemoryStore
from app.main import create_app
from app.requests.models import RequestStatus
from scripts.seed import seed


@pytest.fixture(autouse=True)
async def reset_store_and_clock():
    """Resets memory store and seeds fixtures before each test."""
    set_settings(None)
    store = MemoryStore.get_instance()
    store.reset()
    SimulationClock.reset_instance(
        base_time=datetime(2026, 10, 15, 9, 0, 0, tzinfo=UTC),
        offset_seconds=0.0,
    )
    await seed()
    yield
    set_settings(None)


@pytest.fixture
def demo_client() -> Generator[TestClient, None, None]:
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    app = create_app(settings=settings)
    yield TestClient(app)
    set_settings(None)


@pytest.fixture
def live_client() -> Generator[TestClient, None, None]:
    settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    app = create_app(settings=settings)
    yield TestClient(app)
    set_settings(None)


async def test_run_story_and_metrics(demo_client: TestClient):
    """Verifies that after run_story, the request is FULFILLED and metrics are non-zero."""
    store = MemoryStore.get_instance()
    sim_clock = SimulationClock.get_instance()

    # Execute demo story
    req = await run_story(store=store, clock=sim_clock, step_delay_seconds=0.0)
    assert req.status == RequestStatus.FULFILLED
    assert req.accepted == 2

    # Query metrics endpoint
    resp = demo_client.get("/metrics", headers={"X-Demo-Role": "staff"})
    assert resp.status_code == 200
    metrics = resp.json()

    assert metrics["requests"] >= 1
    assert metrics["medianMinutesToFirstOnTheWay"] > 0
    assert metrics["medianMinutesToCovered"] > 0
    assert metrics["medianMinutesToFulfilled"] > 0
    assert metrics["callsPerAccepted"] > 0
    assert metrics["standDownReachPct"] == 100.0
    assert metrics["isSimulated"] is True

    # Baseline comparison metrics
    assert metrics["baseline"]["toFirstOnTheWay"] == 45
    assert metrics["baseline"]["toCovered"] == 90
    assert metrics["baseline"]["toFulfilled"] == 180


def test_admin_scenario_run_and_advance(demo_client: TestClient):
    """Verifies demo admin endpoints trigger scenario and advance clock."""
    # Run scenario
    resp_scenario = demo_client.post(
        "/admin/scenario/story/run", headers={"X-Demo-Role": "hospital"}
    )
    assert resp_scenario.status_code == 200
    assert resp_scenario.json() == {"ok": True}

    # Advance clock
    resp_advance = demo_client.post(
        "/admin/clock/advance",
        headers={"X-Demo-Role": "admin"},
        json={"minutes": 15},
    )
    assert resp_advance.status_code == 200
    assert resp_advance.json() == {"ok": True}

    # Reset demo
    resp_reset = demo_client.post("/admin/reset", headers={"X-Demo-Role": "admin"})
    assert resp_reset.status_code == 200
    assert resp_reset.json() == {"ok": True}


def test_admin_endpoints_return_404_in_live_mode(live_client: TestClient):
    """Verifies all demo admin endpoints return 404 in live data mode."""
    # Scenario run -> 404
    resp_scenario = live_client.post("/admin/scenario/story/run")
    assert resp_scenario.status_code == 404

    # Reset -> 404
    resp_reset = live_client.post("/admin/reset")
    assert resp_reset.status_code == 404

    # Clock advance -> 404
    resp_advance = live_client.post("/admin/clock/advance", json={"minutes": 10})
    assert resp_advance.status_code == 404


def test_metrics_staff_only_in_live_mode():
    """Verifies GET /metrics in live mode requires staff role."""
    settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    app = create_app(settings=settings)

    # 1. Anonymous in live mode -> 403
    client = TestClient(app)
    resp_anon = client.get("/metrics")
    assert resp_anon.status_code == 403

    # 2. Staff in live mode -> 200
    app.dependency_overrides[get_actor] = lambda: Actor(role="staff", user_id="staff-01")
    resp_staff = client.get("/metrics")
    assert resp_staff.status_code == 200
    assert resp_staff.json()["isSimulated"] is False

    # Clean up overrides
    app.dependency_overrides.clear()
    set_settings(None)


def test_demo_telephony_auth_required(demo_client: TestClient):
    """Verifies GET and POST /admin/demo/telephony require staff/admin actor."""
    # 1. No auth -> 401
    resp_get_anon = demo_client.get("/admin/demo/telephony")
    assert resp_get_anon.status_code == 401

    resp_post_anon = demo_client.post(
        "/admin/demo/telephony", json={"adapter": "simulator"}
    )
    assert resp_post_anon.status_code == 401

    # 2. Non-staff (hospital role) -> 403
    resp_get_hosp = demo_client.get(
        "/admin/demo/telephony", headers={"X-Demo-Role": "hospital"}
    )
    assert resp_get_hosp.status_code == 403

    resp_post_hosp = demo_client.post(
        "/admin/demo/telephony",
        json={"adapter": "simulator"},
        headers={"X-Demo-Role": "hospital"},
    )
    assert resp_post_hosp.status_code == 403

    # 3. Staff -> 200 on GET
    resp_get_staff = demo_client.get(
        "/admin/demo/telephony", headers={"X-Demo-Role": "staff"}
    )
    assert resp_get_staff.status_code == 200
    assert resp_get_staff.json()["adapter"] == "simulator"


def test_demo_telephony_switch_and_validation():
    """Verifies switching to Twilio returns 409 if config is missing/malformed and 200 if valid."""
    # 1. Default demo settings (unconfigured Twilio) -> 409 on twilio switch
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
        ALLOW_TEST_HEADER_AUTH=True,
    )
    app = create_app(settings=settings)
    client = TestClient(app)

    resp_conflict = client.post(
        "/admin/demo/telephony",
        json={"adapter": "twilio"},
        headers={"X-Demo-Role": "staff"},
    )
    assert resp_conflict.status_code == 409
    assert "Cannot switch to Twilio" in resp_conflict.json()["detail"]
    assert "TWILIO_ACCOUNT_SID" in resp_conflict.json()["detail"]

    # Switching to simulator works -> 200
    resp_sim = client.post(
        "/admin/demo/telephony",
        json={"adapter": "simulator"},
        headers={"X-Demo-Role": "staff"},
    )
    assert resp_sim.status_code == 200
    assert resp_sim.json()["adapter"] == "simulator"

    # 2. Valid Twilio settings -> 200 on twilio switch
    valid_settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
        ALLOW_TEST_HEADER_AUTH=True,
        TWILIO_ACCOUNT_SID="AC" + ("mock" * 8),
        TWILIO_AUTH_TOKEN="mock_auth_token_for_tests_32ch",
        TWILIO_FROM_NUMBER="+15550001234",
        CALL_ALLOWLIST="+910000000000",
    )
    app_valid = create_app(settings=valid_settings)
    client_valid = TestClient(app_valid)

    resp_valid = client_valid.post(
        "/admin/demo/telephony",
        json={"adapter": "twilio"},
        headers={"X-Demo-Role": "staff"},
    )
    assert resp_valid.status_code == 200
    assert resp_valid.json()["adapter"] == "twilio"
    set_settings(None)


def test_demo_telephony_live_mode_404(live_client: TestClient):
    """Verifies /admin/demo/telephony returns 404 in live data mode."""
    # With staff auth in live mode -> 404
    resp_get = live_client.get(
        "/admin/demo/telephony", headers={"X-Demo-Role": "staff"}
    )
    assert resp_get.status_code == 404

    resp_post = live_client.post(
        "/admin/demo/telephony",
        json={"adapter": "simulator"},
        headers={"X-Demo-Role": "staff"},
    )
    assert resp_post.status_code == 404

