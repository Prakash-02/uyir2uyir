import os

import pytest
from fastapi.testclient import TestClient

# Ensure default environment variables for testing before Settings is instantiated
os.environ.setdefault("GEMINI_MODEL", "gemini-2.5-flash")
os.environ.setdefault("DATA_MODE", "demo")
os.environ.setdefault("FIRESTORE_DB", "u2u-demo")
os.environ.setdefault("ALLOW_TEST_HEADER_AUTH", "true")

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def test_settings() -> Settings:
    """Fixture providing valid demo Settings for testing."""
    return Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.5-flash",
        ALLOW_TEST_HEADER_AUTH=True,
    )


@pytest.fixture
def client(test_settings: Settings) -> TestClient:
    """Fixture providing a FastAPI TestClient configured for testing."""
    app = create_app(settings=test_settings)
    return TestClient(app)
