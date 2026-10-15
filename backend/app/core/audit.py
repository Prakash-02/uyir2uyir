"""Append-only audit log for sensitive operational actions.

Guarantees:
- Never includes personal identifiable values (PII), patient names, or phone numbers.
- Records actor uid, role, mode, action, target ID, before and after status, and timestamp.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import Store, TransactionStore


class AuditEntry(CamelModel):
    id: str
    actor_uid: str
    role: str
    mode: str
    action: str  # create | cancel | accept | defer | confirm | opt-out
    target_id: str
    before_status: str | None = None
    after_status: str | None = None
    at: str


async def record_audit(
    store: Store | TransactionStore,
    actor_uid: str,
    role: str,
    action: str,
    target_id: str,
    before_status: str | None = None,
    after_status: str | None = None,
    mode: str | None = None,
    at: str | None = None,
) -> dict[str, Any]:
    """Appends an immutable audit entry to the store."""
    settings = get_settings()
    entry = AuditEntry(
        id=f"audit-{uuid.uuid4().hex[:12]}",
        actor_uid=actor_uid,
        role=role,
        mode=mode or settings.DATA_MODE,
        action=action,
        target_id=target_id,
        before_status=before_status,
        after_status=after_status,
        at=at or datetime.now(UTC).isoformat(),
    )
    payload = entry.model_dump(by_alias=True)
    await store.append_audit_entry(payload)
    return payload
