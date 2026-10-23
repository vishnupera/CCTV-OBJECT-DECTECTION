"""Stream API: MJPEG endpoint and snapshot."""
from __future__ import annotations

import asyncio
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.security.dependencies import require_any
from app.vision.pipeline import all_pipelines, get_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stream", tags=["stream"])

BOUNDARY = b"--frame\r\n"
CONTENT_TYPE = b"Content-Type: image/jpeg\r\n\r\n"


async def _mjpeg_generator(camera_id: str):
    """Async generator that yields MJPEG frames."""
    import asyncio

    while True:
        pipeline = get_pipeline(camera_id)
        if pipeline is None:
            # No pipeline yet — yield a "not available" JPEG or empty
            yield BOUNDARY + CONTENT_TYPE + _placeholder_jpeg() + b"\r\n"
            await asyncio.sleep(0.5)
            continue

        jpeg = pipeline.get_jpeg()
        if jpeg:
            yield BOUNDARY + CONTENT_TYPE + jpeg + b"\r\n"
        await asyncio.sleep(1.0 / 10)  # target 10fps for stream


@router.get("/mjpeg/{camera_id}")
async def mjpeg_stream(camera_id: str, _=Depends(require_any)):
    return StreamingResponse(
        _mjpeg_generator(camera_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/snapshot/{camera_id}")
async def snapshot(camera_id: str, _=Depends(require_any)):
    pipeline = get_pipeline(camera_id)
    if not pipeline:
        raise HTTPException(404, "Camera pipeline not running")
    jpeg = pipeline.get_jpeg()
    if not jpeg:
        raise HTTPException(503, "No frame available")
    return Response(content=jpeg, media_type="image/jpeg")


@router.get("/state/{camera_id}")
async def stream_state(camera_id: str, _=Depends(require_any)):
    pipeline = get_pipeline(camera_id)
    if not pipeline:
        raise HTTPException(404, "Camera pipeline not running")
    return pipeline.get_state()


@router.get("/list")
async def list_streams(_=Depends(require_any)):
    return list(all_pipelines().keys())


def _placeholder_jpeg() -> bytes:
    """Return a small placeholder JPEG when no frame is available."""
    import cv2
    import numpy as np

    img = np.zeros((240, 320, 3), dtype=np.uint8)
    img[:] = (9, 35, 40)  # background color
    cv2.putText(img, "No Signal", (90, 120), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (42, 131, 95), 2)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()
