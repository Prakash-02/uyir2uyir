"""Image input processing and sanitation for U2U Request Desk.

Validates uploaded photos:
1. Max 5 MB upload size.
2. Magic bytes validation: strictly JPEG, PNG, or WebP.
3. Megapixel cap: rejects images > 40 megapixels (DoS protection).
4. EXIF orientation transposed to preserve user layout.
5. Resize longest edge to at most 1600 px (LANCZOS filter).
6. Strips all EXIF / GPS / device metadata by re-encoding to JPEG quality 85 in memory.
7. NEVER writes images to disk or persistent storage.
"""

import io
import logging
from typing import Final

from fastapi import HTTPException
from PIL import Image, ImageOps

logger = logging.getLogger("u2u.desk.image_input")

MAX_UPLOAD_BYTES: Final[int] = 5 * 1024 * 1024  # 5 MB
MAX_MEGAPIXELS: Final[int] = 40_000_000  # 40 MP
MAX_IMAGE_DIMENSION: Final[int] = 1600
GENERIC_CLIENT_ERROR: Final[str] = "Please upload a JPG, PNG or WebP photo under 5 MB."


def is_jpeg(data: bytes) -> bool:
    return len(data) >= 3 and data[:3] == b"\xff\xd8\xff"


def is_png(data: bytes) -> bool:
    return len(data) >= 8 and data[:8] == b"\x89PNG\r\n\x1a\n"


def is_webp(data: bytes) -> bool:
    return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"


def validate_and_sanitize_image(image_bytes: bytes) -> bytes:
    """Validates magic bytes, size, resolution, strips EXIF, and re-encodes to JPEG quality 85.

    Returns the sanitized JPEG bytes.
    Raises HTTPException(400) on invalid type, oversized file, or corrupt image data.
    """
    if not image_bytes or len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=GENERIC_CLIENT_ERROR,
        )

    # Magic byte check
    if not (is_jpeg(image_bytes) or is_png(image_bytes) or is_webp(image_bytes)):
        raise HTTPException(
            status_code=400,
            detail=GENERIC_CLIENT_ERROR,
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size
            if width * height > MAX_MEGAPIXELS:
                raise HTTPException(
                    status_code=400,
                    detail=GENERIC_CLIENT_ERROR,
                )

            # Apply EXIF rotation if present
            transposed = ImageOps.exif_transpose(img)
            if transposed is not None:
                img = transposed

            # Convert to RGB (dropping alpha channels, palette maps, and EXIF dictionary)
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Scale longest dimension down to max 1600 px preserving aspect ratio
            w, h = img.size
            longest = max(w, h)
            if longest > MAX_IMAGE_DIMENSION:
                scale = MAX_IMAGE_DIMENSION / float(longest)
                new_w = max(1, int(round(w * scale)))
                new_h = max(1, int(round(h * scale)))
                resampling = getattr(Image.Resampling, "LANCZOS", Image.LANCZOS)
                img = img.resize((new_w, new_h), resampling)

            # Re-encode to JPEG quality 85 (no exif passed -> metadata completely stripped)
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=85, optimize=True)
            return out.getvalue()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Image validation/re-encoding failed: %s", exc)
        raise HTTPException(
            status_code=400,
            detail=GENERIC_CLIENT_ERROR,
        ) from exc
