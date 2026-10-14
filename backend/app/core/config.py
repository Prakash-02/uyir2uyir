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
    GOOGLE_CLOUD_PROJECT: str | None = Field(default=None, description="GCP project ID")
    FIRESTORE_DB: str = Field(default="u2u-demo", description="Firestore database name")

    # Vertex AI & Gemini
    VERTEX_LOCATION: str = Field(default="asia-south1", description="Vertex AI region")
    GEMINI_MODEL: str = Field(
        ...,
        description="Gemini model name, explicitly read from environment with no default in code",
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


@lru_cache
def get_settings() -> Settings:
    """Returns a cached Settings instance."""
    return Settings()
