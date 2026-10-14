import pytest

from app.core.config import Settings
from app.core.mode_guard import ModeGuardError, verify_mode_guard
from app.main import create_app


def test_mode_guard_allows_valid_demo() -> None:
    """Mode guard permits DATA_MODE=demo with FIRESTORE_DB=u2u-demo."""
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    # Should not raise
    verify_mode_guard(settings)


def test_mode_guard_allows_valid_live() -> None:
    """Mode guard permits DATA_MODE=live with FIRESTORE_DB=u2u-live."""
    settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    # Should not raise
    verify_mode_guard(settings)


def test_mode_guard_refuses_live_with_demo_db() -> None:
    """Mode guard rejects live mode targeting u2u-demo database."""
    settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    with pytest.raises(
        ModeGuardError, match="DATA_MODE is 'live' but FIRESTORE_DB is set to 'u2u-demo'"
    ):
        verify_mode_guard(settings)


def test_mode_guard_refuses_demo_with_live_db() -> None:
    """Mode guard rejects demo mode targeting u2u-live database."""
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    with pytest.raises(
        ModeGuardError, match="DATA_MODE is 'demo' but FIRESTORE_DB is set to 'u2u-live'"
    ):
        verify_mode_guard(settings)


def test_mode_guard_blocks_app_creation_on_mismatch() -> None:
    """App factory create_app() raises ModeGuardError if configuration mismatches."""
    invalid_settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    with pytest.raises(ModeGuardError):
        create_app(settings=invalid_settings)


def test_mode_guard_rejects_unknown_mode() -> None:
    """Mode guard rejects unknown DATA_MODE values."""
    settings = Settings(
        DATA_MODE="staging",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
    )
    with pytest.raises(ModeGuardError, match="DATA_MODE must be either 'demo' or 'live'"):
        verify_mode_guard(settings)
