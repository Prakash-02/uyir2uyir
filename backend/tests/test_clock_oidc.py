"""Unit tests for /internal/tick authentication with INTERNAL_TOKEN and Google OIDC tokens."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings, set_settings
from app.main import create_app


@pytest.fixture
def test_client() -> TestClient:
    app = create_app()
    return TestClient(app)


def test_internal_tick_with_shared_secret(test_client: TestClient) -> None:
    settings = get_settings()
    # Test with INTERNAL_TOKEN header
    resp = test_client.post("/internal/tick", headers={"INTERNAL_TOKEN": settings.INTERNAL_TOKEN})
    assert resp.status_code == 200

    # Test with X-Internal-Token header
    resp2 = test_client.post(
        "/internal/tick", headers={"X-Internal-Token": settings.INTERNAL_TOKEN}
    )
    assert resp2.status_code == 200

    # Test with Bearer internal token
    resp3 = test_client.post(
        "/internal/tick", headers={"Authorization": f"Bearer {settings.INTERNAL_TOKEN}"}
    )
    assert resp3.status_code == 200


def test_internal_tick_missing_or_bad_token(test_client: TestClient) -> None:
    resp = test_client.post("/internal/tick")
    assert resp.status_code == 401
    assert "Invalid or missing internal token" in resp.json()["detail"]

    resp_bad = test_client.post("/internal/tick", headers={"INTERNAL_TOKEN": "wrong-token"})
    assert resp_bad.status_code == 401


def test_internal_tick_with_valid_google_oidc_token(test_client: TestClient) -> None:
    test_settings = Settings(
        GEMINI_MODEL="gemini-2.0-flash",
        DATA_MODE="demo",
        GOOGLE_CLOUD_PROJECT="uyir2uyir-demo-test",
        SCHEDULER_SERVICE_ACCOUNT="sa-scheduler@uyir2uyir-demo-test.iam.gserviceaccount.com",
        PUBLIC_BASE_URL="https://u2u-api-demo.a.run.app",
    )
    set_settings(test_settings)
    try:
        with patch("google.oauth2.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "iss": "https://accounts.google.com",
                "aud": "https://u2u-api-demo.a.run.app",
                "email": "sa-scheduler@uyir2uyir-demo-test.iam.gserviceaccount.com",
                "email_verified": True,
            }

            resp = test_client.post(
                "/internal/tick",
                headers={"Authorization": "Bearer mock-valid-google-oidc-jwt"},
            )
            assert resp.status_code == 200
            mock_verify.assert_called_once()
    finally:
        set_settings(None)


def test_internal_tick_with_mismatched_scheduler_sa(test_client: TestClient) -> None:
    test_settings = Settings(
        GEMINI_MODEL="gemini-2.0-flash",
        DATA_MODE="demo",
        GOOGLE_CLOUD_PROJECT="uyir2uyir-demo-test",
        SCHEDULER_SERVICE_ACCOUNT="sa-scheduler@uyir2uyir-demo-test.iam.gserviceaccount.com",
        PUBLIC_BASE_URL="https://u2u-api-demo.a.run.app",
    )
    set_settings(test_settings)
    try:
        with patch("google.oauth2.id_token.verify_oauth2_token") as mock_verify:
            mock_verify.return_value = {
                "iss": "https://accounts.google.com",
                "aud": "https://u2u-api-demo.a.run.app",
                "email": "impostor@malicious.com",
                "email_verified": True,
            }

            resp = test_client.post(
                "/internal/tick",
                headers={"Authorization": "Bearer mock-foreign-oidc-jwt"},
            )
            assert resp.status_code == 401
            assert "does not match expected scheduler service account" in resp.json()["detail"]
    finally:
        set_settings(None)


def test_internal_tick_with_invalid_oidc_token(test_client: TestClient) -> None:
    with patch(
        "google.oauth2.id_token.verify_oauth2_token", side_effect=ValueError("Token expired")
    ):
        resp = test_client.post(
            "/internal/tick",
            headers={"Authorization": "Bearer expired-google-oidc-jwt"},
        )
        assert resp.status_code == 401
        assert "Invalid OIDC token" in resp.json()["detail"]
