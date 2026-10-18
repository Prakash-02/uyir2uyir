from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile

from app.desk.links import execute_confirm_action, get_confirm_link_preview
from app.desk.models import (
    ConfirmRequest,
    DeskCheckRequest,
    DeskResult,
    RequestPreview,
)
from app.desk.pipeline import check_desk_image_pipeline, check_desk_pipeline
from app.requests.models import BloodRequest

desk_router = APIRouter(tags=["desk"])


@desk_router.post("/desk/check", response_model=DeskResult)
async def check_desk(
    payload: DeskCheckRequest,
    request: Request,
) -> DeskResult:
    """Public Request Desk endpoint: one Gemini extraction call, verified verbatim by code."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    return await check_desk_pipeline(payload.text, client_ip=client_ip)


@desk_router.post("/desk/check-image", response_model=DeskResult)
async def check_desk_image(
    request: Request,
    image: Annotated[UploadFile, File()],
    text: Annotated[str, Form()] = "",
) -> DeskResult:
    """Public Request Desk photo upload: one Gemini multimodal call, verified verbatim by code."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    image_bytes = await image.read()
    return await check_desk_image_pipeline(
        image_bytes=image_bytes,
        caption=text,
        client_ip=client_ip,
    )


@desk_router.get("/confirm/{token}", response_model=RequestPreview)
async def get_confirmation_preview(token: str) -> RequestPreview:
    """Hospital blood bank one-tap link preview with masked patient reference."""
    return await get_confirm_link_preview(token)


@desk_router.post("/confirm", response_model=BloodRequest)
async def post_confirmation(payload: ConfirmRequest) -> BloodRequest:
    """Hospital blood bank decision: RAISE (transitions to OPEN and calls donors) or NOT_OUR_PATIENT (REJECTED)."""
    return await execute_confirm_action(payload.token, payload.action)
