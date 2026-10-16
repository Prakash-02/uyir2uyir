"""One-time stream tokens for Twilio WebSocket audio streams.

Guarantees:
- Tokens are cryptographically random (secrets.token_urlsafe).
- Stored hashed (SHA-256) in Firestore / Store.
- Tied strictly to a specific callId.
- 2-minute expiration window.
- Single use: consumed and deleted immediately upon verification.
"""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.store import Store

logger = logging.getLogger("u2u.voice.tokens")


def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hex digest of a raw stream token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def create_stream_token(
    store: Store,
    call_id: str,
    expiry_seconds: int = 120,
) -> str:
    """Generates and stores a hashed, one-time stream token for a call."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)

    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=expiry_seconds)

    data: dict[str, Any] = {
        "callId": call_id,
        "tokenHash": token_hash,
        "createdAt": now.isoformat(),
        "expiresAt": expires_at.isoformat(),
        "used": False,
    }

    await store.save_stream_token(token_hash, data)
    logger.debug("Created stream token for call %s (expires in %ds)", call_id, expiry_seconds)
    return raw_token


async def verify_and_consume_stream_token(
    store: Store,
    call_id: str,
    raw_token: str,
) -> bool:
    """Validates and single-use consumes a stream token tied to call_id.

    Returns True if token is valid, matches call_id, has not expired, and has not been used.
    Returns False otherwise.
    """
    if not raw_token or not call_id:
        return False

    token_hash = hash_token(raw_token)
    doc = await store.get_stream_token(token_hash)
    if not doc:
        logger.warning("Stream token not found: %s...", token_hash[:12])
        return False

    # Verify callId binding
    if doc.get("callId") != call_id:
        logger.warning(
            "Stream token callId mismatch: token is for %s, requested for %s",
            doc.get("callId"),
            call_id,
        )
        return False

    # Verify single use
    if doc.get("used", False):
        logger.warning("Stream token already used: %s...", token_hash[:12])
        return False

    # Verify expiration (2 minutes)
    expires_at_str = doc.get("expiresAt")
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            if datetime.now(UTC) > expires_at:
                logger.warning("Stream token expired at %s for call %s", expires_at_str, call_id)
                # Cleanup expired token
                await store.delete_stream_token(token_hash)
                return False
        except Exception as e:
            logger.warning("Malformed expiresAt '%s' in stream token: %s", expires_at_str, e)
            return False

    # Consume single-use token: delete from store
    await store.delete_stream_token(token_hash)
    logger.debug("Successfully verified and consumed stream token for call %s", call_id)
    return True
