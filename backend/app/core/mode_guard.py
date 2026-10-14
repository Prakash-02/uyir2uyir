from app.core.config import Settings


class ModeGuardError(RuntimeError):
    """Raised when DATA_MODE and FIRESTORE_DB configurations mismatch."""

    pass


def verify_mode_guard(settings: Settings) -> None:
    """Validates that DATA_MODE aligns strictly with FIRESTORE_DB.

    Prevents catastrophic database cross-contamination:
    - DATA_MODE=live must connect to 'u2u-live'.
    - DATA_MODE=demo must connect to 'u2u-demo'.
    """
    if settings.DATA_MODE == "live" and settings.FIRESTORE_DB != "u2u-live":
        raise ModeGuardError(
            f"ModeGuard Error: DATA_MODE is 'live' but FIRESTORE_DB is set to '{settings.FIRESTORE_DB}'. "
            "Must be 'u2u-live' to prevent production database corruption."
        )

    if settings.DATA_MODE == "demo" and settings.FIRESTORE_DB != "u2u-demo":
        raise ModeGuardError(
            f"ModeGuard Error: DATA_MODE is 'demo' but FIRESTORE_DB is set to '{settings.FIRESTORE_DB}'. "
            "Must be 'u2u-demo' to prevent mock data from polluting production."
        )

    if settings.DATA_MODE not in ("demo", "live"):
        raise ModeGuardError(
            f"ModeGuard Error: DATA_MODE must be either 'demo' or 'live', got '{settings.DATA_MODE}'."
        )
