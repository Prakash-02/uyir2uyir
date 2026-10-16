"""Phone vault encryption and secure contact storage using AES-256-GCM.

Guarantees:
- Raw phone numbers are encrypted with AES-256-GCM using PHONE_KEY.
- Lookups use blind HMAC-SHA256 hashes.
- Only the last 4 digits are accessible for masked staff displays.
- Full phone numbers are NEVER returned in any endpoint response or stored in plain text.
"""

import base64
import hashlib
import hmac
import os
import re
from datetime import UTC, datetime
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings
from app.core.store import Store, TransactionStore

# Indian mobile format: optional +91 / 91 / 0 prefix, first digit 6-9, followed by 9 digits
INDIAN_MOBILE_REGEX = re.compile(r"^(?:(?:\+|00)?91|0)?[6-9]\d{9}$")
# General E.164 format: leading +, country code (1-9), followed by 6 to 14 digits
E164_REGEX = re.compile(r"^\+[1-9]\d{6,14}$")


def validate_indian_mobile(phone: str) -> str:
    """Validates and normalizes an Indian mobile phone number to E.164 (+91XXXXXXXXXX).

    Raises:
        ValueError: If phone does not match valid Indian mobile pattern.
    """
    cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
    if not INDIAN_MOBILE_REGEX.match(cleaned):
        raise ValueError("Invalid Indian mobile number format")

    if cleaned.startswith("+91"):
        digits = cleaned[3:]
    elif cleaned.startswith("0091"):
        digits = cleaned[4:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    else:
        digits = cleaned

    return f"+91{digits}"


def normalize_phone_number(phone: str) -> str:
    """Validates and normalizes phone number to E.164.

    Accepts numbers in E.164 format (+...) or standard Indian mobile formats.
    """
    cleaned = re.sub(r"[\s\-\(\)]", "", phone.strip())
    if E164_REGEX.match(cleaned):
        return cleaned
    return validate_indian_mobile(phone)


def get_encryption_key(key_str: str | None = None) -> bytes:
    """Derives a 256-bit AES key from the configured PHONE_KEY."""
    if key_str is None:
        key_str = get_settings().PHONE_KEY
    return hashlib.sha256(key_str.encode("utf-8")).digest()


def mask_phone_last4(last4: str, prefix: str = "+91") -> str:
    """Formats safe masked representation for staff / audit display."""
    return f"{prefix} ••••• ••{last4}"


def encrypt_phone(phone: str, key: bytes | None = None) -> tuple[str, str, str]:
    """Encrypts a phone number using AES-256-GCM.

    Returns:
        (encrypted_b64, phone_hash, last4)
    """
    if key is None:
        key = get_encryption_key()

    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # Standard 96-bit nonce
    ciphertext = aesgcm.encrypt(nonce, phone.encode("utf-8"), None)
    encrypted_b64 = base64.b64encode(nonce + ciphertext).decode("utf-8")

    phone_hash = hmac.new(key, phone.encode("utf-8"), hashlib.sha256).hexdigest()

    digits_only = re.sub(r"\D", "", phone)
    last4 = digits_only[-4:] if len(digits_only) >= 4 else digits_only

    return encrypted_b64, phone_hash, last4


def decrypt_phone(encrypted_b64: str, key: bytes | None = None) -> str:
    """Decrypts an encrypted phone number using AES-256-GCM.

    Strict internal telephony use only. Never expose to public or UI endpoints.
    """
    if key is None:
        key = get_encryption_key()

    raw = base64.b64decode(encrypted_b64)
    nonce = raw[:12]
    ciphertext = raw[12:]
    aesgcm = AESGCM(key)
    decrypted = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted.decode("utf-8")


async def store_donor_contact(
    store: Store | TransactionStore,
    donor_id: str,
    raw_phone: str,
) -> dict[str, Any]:
    """Normalizes, encrypts, and stores donor contact in donorContacts/{donor_id}.

    Never stores or returns the raw phone number.
    """
    normalized = normalize_phone_number(raw_phone)
    encrypted_b64, phone_hash, last4 = encrypt_phone(normalized)

    prefix = "+1" if normalized.startswith("+1") else "+91"
    now_iso = datetime.now(UTC).isoformat()
    contact_data = {
        "donorId": donor_id,
        "encryptedPhone": encrypted_b64,
        "phoneHash": phone_hash,
        "last4": last4,
        "createdAt": now_iso,
        "updatedAt": now_iso,
    }
    await store.save_donor_contact(donor_id, contact_data)
    return {
        "donorId": donor_id,
        "phoneHash": phone_hash,
        "last4": last4,
        "phoneMasked": mask_phone_last4(last4, prefix=prefix),
    }
