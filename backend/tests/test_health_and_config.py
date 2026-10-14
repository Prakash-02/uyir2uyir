from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_healthz_returns_200(client: TestClient) -> None:
    """GET /healthz returns status 200 with ok status."""
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_config_returns_demo_banner_in_demo_mode(client: TestClient) -> None:
    """GET /config in demo mode returns camelCase fields and orange simulated banner."""
    response = client.get("/config")
    assert response.status_code == 200
    data = response.json()

    # Verify camelCase contract adherence
    assert "dataMode" in data
    assert "bannerText" in data
    assert "weatherAlert" in data
    assert "data_mode" not in data
    assert "banner_text" not in data

    # Verify field values
    assert data["dataMode"] == "demo"
    assert data["bannerText"] == "SIMULATED DATA · Demo mode · No real donors or patients"
    assert data["weatherAlert"] is False


def test_config_returns_null_banner_in_live_mode() -> None:
    """GET /config in live mode returns null bannerText."""
    live_settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    live_app = create_app(settings=live_settings)
    live_client = TestClient(live_app)

    response = live_client.get("/config")
    assert response.status_code == 200
    data = response.json()

    assert data["dataMode"] == "live"
    assert data["bannerText"] is None
    assert data["weatherAlert"] is False
