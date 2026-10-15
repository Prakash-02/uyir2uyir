from typing import Annotated

from fastapi import Header, HTTPException, status

from app.core.config import get_settings
from app.core.models import CamelModel


class Actor(CamelModel):
    user_id: str = "demo-user"
    role: str = "public"  # "hospital", "staff", "admin", "public"
    hospital_id: str | None = None
    centre_id: str | None = None


async def get_actor(
    x_demo_role: Annotated[str | None, Header(alias="X-Demo-Role")] = None,
    x_demo_hospital_id: Annotated[str | None, Header(alias="X-Demo-Hospital-Id")] = None,
    x_demo_centre_id: Annotated[str | None, Header(alias="X-Demo-Centre-Id")] = None,
) -> Actor:
    """Extracts actor credentials.

    In demo mode: reads X-Demo-Role (hospital | staff | admin).
    In live mode: forbids X-Demo-Role (to be replaced with Firebase Auth in Prompt B7).
    """
    settings = get_settings()

    if x_demo_role is not None:
        if settings.DATA_MODE != "demo":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="X-Demo-Role header is not permitted in live data mode.",
            )
        role = x_demo_role.lower()
        if role not in ("hospital", "staff", "admin", "public"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid X-Demo-Role: '{x_demo_role}'. Expected 'hospital', 'staff', 'admin', or 'public'.",
            )
        return Actor(
            user_id=f"demo-{role}-user",
            role=role,
            hospital_id=x_demo_hospital_id or ("hosp-sample-1" if role == "hospital" else None),
            centre_id=x_demo_centre_id or ("centre-sample-1" if role == "staff" else None),
        )

    # No role header passed -> unauthenticated / public
    return Actor(user_id="anonymous", role="public")


async def require_hospital_actor(
    x_demo_role: Annotated[str | None, Header(alias="X-Demo-Role")] = None,
    x_demo_hospital_id: Annotated[str | None, Header(alias="X-Demo-Hospital-Id")] = None,
) -> Actor:
    """Requires an actor with hospital role."""
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication requires live token in live mode.",
        )
    if not x_demo_role or x_demo_role.lower() != "hospital":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Hospital role required.",
        )
    return Actor(
        user_id="demo-hospital-user",
        role="hospital",
        hospital_id=x_demo_hospital_id or "hosp-sample-1",
    )


async def require_staff_actor(
    x_demo_role: Annotated[str | None, Header(alias="X-Demo-Role")] = None,
    x_demo_centre_id: Annotated[str | None, Header(alias="X-Demo-Centre-Id")] = None,
) -> Actor:
    """Requires an actor with staff role."""
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authentication requires live token in live mode.",
        )
    if not x_demo_role or x_demo_role.lower() != "staff":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Blood centre staff role required.",
        )
    return Actor(
        user_id="demo-staff-user",
        role="staff",
        centre_id=x_demo_centre_id or "centre-sample-1",
    )
