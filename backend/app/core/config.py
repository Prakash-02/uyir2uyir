from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core application settings loaded from environment variables and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Operational mode & Database
    DATA_MODE: str = Field(default="demo", description="Operational mode: demo or live")
    STORE: str = Field(default="memory", description="Storage backend: memory or firestore")
    GOOGLE_CLOUD_PROJECT: str | None = Field(default=None, description="GCP project ID")
    FIRESTORE_DB: str = Field(default="u2u-demo", description="Firestore database name")

    # Vertex AI & Gemini
    VERTEX_LOCATION: str = Field(default="asia-south1", description="Vertex AI region")
    GEMINI_MODEL: str = Field(
        ...,
        description="Gemini model name, explicitly read from environment with no default in code",
    )
    LIVE_MODEL: str = Field(
        default="gemini-2.0-flash-exp",
        description="Gemini Live model name for experimental multimodal calling",
    )
    LIVE_LOCATION: str = Field(
        default="us-central1",
        description="GCP location for Gemini Live sessions",
    )
    LIVE_DAILY_MINUTES: int = Field(
        default=60,
        description="Daily cap on live calling session duration in minutes",
    )

    # Security & Keys
    LINK_SIGNING_KEY: str = Field(
        default="dev-secret-link-signing-key-replace-in-production",
        description="Key used to sign and verify one-time confirmation links",
    )
    INTERNAL_TOKEN: str = Field(
        default="dev-internal-token",
        description="Shared secret for local clock tick protection",
    )
    PUBLIC_BASE_URL: str = Field(
        default="http://localhost:8080",
        description="Public URL of the service, used for Twilio signatures and links",
    )
    ALLOWED_ORIGINS: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins",
    )
    PHONE_KEY: str = Field(
        default="u2u-default-dev-phone-key-32-bytes-long",
        description="AES-GCM key from Secret Manager for phone vault",
    )
    ALLOW_TEST_HEADER_AUTH: bool = Field(
        default=False,
        description="Allow X-Demo-Role header in tests; off by default in production",
    )
    SCHEDULER_SERVICE_ACCOUNT: str | None = Field(
        default=None,
        description="Expected Cloud Scheduler service account email for OIDC verification",
    )

    # Telephony & Safety Limits
    CALL_ALLOWLIST: str = Field(
        default="",
        description="Comma-separated phone numbers permitted for outbound test calls",
    )
    DAILY_CALL_CAP: int = Field(default=30, description="Max outbound calls permitted per day")
    REQUEST_CALL_CAP: int = Field(
        default=15, description="Max outbound calls permitted per blood request"
    )
    DAILY_GEMINI_CAP: int = Field(default=2000, description="Max Gemini calls permitted per day")

    # Twilio (Optional)
    TWILIO_ACCOUNT_SID: str | None = Field(default=None, description="Twilio Account SID")
    TWILIO_AUTH_TOKEN: str | None = Field(default=None, description="Twilio Auth Token")
    TWILIO_FROM_NUMBER: str | None = Field(default=None, description="Twilio caller ID number")

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parsed list of allowed CORS origins."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @property
    def call_allowlist_set(self) -> set[str]:
        """Parsed set of permitted phone numbers."""
        return {num.strip() for num in self.CALL_ALLOWLIST.split(",") if num.strip()}


_current_settings: Settings | None = None


def set_settings(settings: Settings | None) -> None:
    """Explicitly sets or clears the active settings instance (used by create_app and tests)."""
    global _current_settings
    _current_settings = settings


@lru_cache
def _get_cached_settings() -> Settings:
    return Settings()


def get_settings() -> Settings:
    """Returns the current Settings instance."""
    global _current_settings
    if _current_settings is not None:
        return _current_settings
    return _get_cached_settings()
