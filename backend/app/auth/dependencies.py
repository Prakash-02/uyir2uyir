"""Authentication and authorization dependencies for U2U backend.

Guarantees:
- Verifies Firebase ID tokens using firebase-admin.
- Reads custom claims: role (hospital | staff | admin | public), hospitalId or centreId, and env.
- Rejects requests if claim env does not match current DATA_MODE.
- Restricts X-Demo-Role header authentication strictly to test environments (ALLOW_TEST_HEADER_AUTH=True).
"""

import base64
import json
import logging
from typing import Annotated, Any

import firebase_admin
from fastapi import Depends, Header, HTTPException, status
from firebase_admin import auth as fb_auth

from app.auth.constants import DEMO_STORY_CENTRE_ID, DEMO_STORY_HOSPITAL_ID
from app.core.config import get_settings
from app.core.models import CamelModel

logger = logging.getLogger(__name__)


class Actor(CamelModel):
    user_id: str = "anonymous"
    role: str = "public"  # "hospital", "staff", "admin", "public"
    hospital_id: str | None = None
    centre_id: str | None = None
    env: str | None = None
    claims: dict[str, Any] = {}


def _init_firebase_admin() -> Any:
    """Initializes or retrieves the default firebase-admin app."""
    try:
        return firebase_admin.get_app()
    except ValueError:
        settings = get_settings()
        return firebase_admin.initialize_app(options={"projectId": settings.GOOGLE_CLOUD_PROJECT})


def verify_token(token: str) -> dict[str, Any]:
    """Verifies a Firebase ID token.

    Supports mock test tokens prefixed with 'mock:' for offline and unit testing.
    """
    if token.startswith("mock:"):
        payload_str = token[5:]
        try:
            return json.loads(payload_str)
        except Exception:
            try:
                return json.loads(base64.b64decode(payload_str).decode("utf-8"))
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Malformed mock authentication token.",
                ) from e

    _init_firebase_admin()
    try:
        return fb_auth.verify_id_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {e}",
        ) from e


async def get_actor(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    x_demo_role: Annotated[str | None, Header(alias="X-Demo-Role")] = None,
    x_demo_hospital_id: Annotated[str | None, Header(alias="X-Demo-Hospital-Id")] = None,
    x_demo_centre_id: Annotated[str | None, Header(alias="X-Demo-Centre-Id")] = None,
) -> Actor:
    """Extracts actor credentials from Firebase Bearer token or test headers."""
    settings = get_settings()

    # Test Header Auth (strictly permitted only when ALLOW_TEST_HEADER_AUTH=True)
    if x_demo_role is not None:
        if not settings.ALLOW_TEST_HEADER_AUTH:
            if not authorization:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="X-Demo-Role header authentication is disabled.",
                )
        else:
            role = x_demo_role.lower()
            if role not in ("hospital", "staff", "admin", "public"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid X-Demo-Role: '{x_demo_role}'.",
                )
            return Actor(
                user_id=f"demo-{role}-user",
                role=role,
                hospital_id=x_demo_hospital_id
                or (DEMO_STORY_HOSPITAL_ID if role in ("hospital", "admin") else None),
                centre_id=x_demo_centre_id
                or (DEMO_STORY_CENTRE_ID if role in ("staff", "admin") else None),
                env=settings.DATA_MODE,
                claims={"role": role, "env": settings.DATA_MODE},
            )

    # Bearer Token Auth
    if authorization is not None and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
        decoded = verify_token(token)
        uid = decoded.get("uid") or decoded.get("sub") or "anonymous"
        role = decoded.get("role", "public").lower()
        env = decoded.get("env")
        hospital_id = decoded.get("hospitalId") or decoded.get("hospital_id")
        centre_id = decoded.get("centreId") or decoded.get("centre_id")

        # Reject the request if env claim doesn't match DATA_MODE
        if env is not None and env != settings.DATA_MODE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Environment mismatch: token env '{env}' does not match DATA_MODE '{settings.DATA_MODE}'.",
            )

        return Actor(
            user_id=uid,
            role=role,
            hospital_id=hospital_id,
            centre_id=centre_id,
            env=env,
            claims=decoded,
        )

    # Unauthenticated / Public actor
    return Actor(user_id="anonymous", role="public")


async def require_signed_in_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Requires an authenticated actor whose env claim matches DATA_MODE."""
    settings = get_settings()
    if not actor or actor.user_id == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if actor.env is not None and actor.env != settings.DATA_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Environment mismatch: token env '{actor.env}' does not match DATA_MODE '{settings.DATA_MODE}'.",
        )
    return actor


async def require_hospital_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Requires an authenticated hospital actor."""
    settings = get_settings()
    if not actor or actor.user_id == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if actor.env is not None and actor.env != settings.DATA_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Environment mismatch: token env '{actor.env}' does not match DATA_MODE '{settings.DATA_MODE}'.",
        )
    if actor.role not in ("hospital", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Hospital role required.",
        )
    return actor


async def require_staff_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Requires an authenticated blood centre staff actor."""
    settings = get_settings()
    if not actor or actor.user_id == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if actor.env is not None and actor.env != settings.DATA_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Environment mismatch: token env '{actor.env}' does not match DATA_MODE '{settings.DATA_MODE}'.",
        )
    if actor.role not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Blood centre staff role required.",
        )
    return actor


async def require_staff_or_admin_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Requires an authenticated staff or admin actor."""
    settings = get_settings()
    if actor.user_id == "anonymous":
        if settings.ALLOW_TEST_HEADER_AUTH:
            return Actor(
                user_id="test-staff",
                role="staff",
                centre_id=DEMO_STORY_CENTRE_ID,
                env=settings.DATA_MODE,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    if actor.env is not None and actor.env != settings.DATA_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Environment mismatch: token env '{actor.env}' does not match DATA_MODE '{settings.DATA_MODE}'.",
        )
    if actor.role not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Staff or admin role required.",
        )
    return actor


async def require_demo_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Dependency for demo-only endpoints (story, reset, clock advance, sim press).

    Returns 404 immediately in live mode.
    In demo mode: accepts any signed-in user with env=demo.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo endpoints are not available in live data mode.",
        )
    if actor.env is not None and actor.env != "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Demo environment token required.",
        )
    if actor.user_id == "anonymous" and not settings.ALLOW_TEST_HEADER_AUTH:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return actor


async def require_metrics_actor(
    actor: Annotated[Actor, Depends(get_actor)],
) -> Actor:
    """Dependency for GET /metrics.

    - Demo mode: Any signed-in demo user with env=demo.
    - Live mode: Blood centre staff only (403 for unauthorized).
    """
    settings = get_settings()
    if settings.DATA_MODE == "demo":
        if actor.env is not None and actor.env != "demo":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Demo environment token required.",
            )
        if actor.user_id == "anonymous" and not settings.ALLOW_TEST_HEADER_AUTH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )
        return actor

    # Live mode: staff only
    if actor.role != "staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Staff role required to view metrics in live data mode.",
        )
    if actor.env is not None and actor.env != "live":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Live environment token required.",
        )
    return actor
