"""Authentication endpoints for demo role claims."""

from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, status
from firebase_admin import auth as fb_auth
from pydantic import BaseModel

from app.auth.constants import DEMO_STORY_CENTRE_ID, DEMO_STORY_HOSPITAL_ID
from app.auth.dependencies import _init_firebase_admin, verify_token
from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["Auth"])


class DemoRoleRequest(BaseModel):
    role: str  # hospital | staff | admin | public


@router.post("/demo-role")
async def set_demo_role(
    payload: DemoRoleRequest,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> dict[str, Any]:
    """Sets custom claims on caller's anonymous Firebase account for demo role inspection.

    Claims:
    - role: hospital | staff | admin | public
    - env: demo
    - hospitalId: fixed DEMO_STORY_HOSPITAL_ID (if role is hospital or admin)
    - centreId: fixed DEMO_STORY_CENTRE_ID (if role is staff or admin)

    Returns 404 in live data mode.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo role assignment is only available in demo mode.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required.",
        )

    token = authorization[7:].strip()
    decoded = verify_token(token)
    uid = decoded.get("uid") or decoded.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid token: missing uid.",
        )

    role = payload.role.lower()
    if role not in ("hospital", "staff", "admin", "public"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid demo role '{payload.role}'. Must be hospital, staff, admin, or public.",
        )

    claims = {
        "role": role,
        "env": "demo",
        "hospitalId": DEMO_STORY_HOSPITAL_ID if role in ("hospital", "admin") else None,
        "centreId": DEMO_STORY_CENTRE_ID if role in ("staff", "admin") else None,
    }

    if not token.startswith("mock:"):
        _init_firebase_admin()
        fb_auth.set_custom_user_claims(uid, claims)

    return {
        "ok": True,
        "uid": uid,
        "claims": claims,
    }
