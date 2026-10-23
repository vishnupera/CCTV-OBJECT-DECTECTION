"""Cameras API router."""
from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog, Camera, CameraStatus
from app.security.dependencies import require_any, require_operator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cameras", tags=["cameras"])


class CameraCreate(BaseModel):
    name: str
    description: Optional[str] = None
    source: str  # 0, path, rtsp
    location: Optional[str] = None
    is_enabled: bool = False


class CameraUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    location: Optional[str] = None
    is_enabled: Optional[bool] = None


class CameraOut(BaseModel):
    id: str
    name: str
    description: Optional[str]
    source: str
    location: Optional[str]
    status: str
    is_enabled: bool
    fps: Optional[float]
    last_frame_at: Optional[str]

    model_config = {"from_attributes": True}


def _cam_out(cam: Camera) -> dict:
    return {
        "id": str(cam.id),
        "name": cam.name,
        "description": cam.description,
        "source": cam.source,
        "location": cam.location,
        "status": cam.status,
        "is_enabled": cam.is_enabled,
        "fps": cam.fps,
        "last_frame_at": cam.last_frame_at.isoformat() if cam.last_frame_at else None,
    }


@router.get("/")
async def list_cameras(db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    result = await db.execute(select(Camera).order_by(Camera.name))
    return [_cam_out(c) for c in result.scalars().all()]


@router.post("/", status_code=201)
async def create_camera(
    body: CameraCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    cam = Camera(**body.model_dump())
    if cam.is_enabled:
        cam.status = CameraStatus.online.value
    else:
        cam.status = CameraStatus.offline.value
    db.add(cam)
    await db.flush()

    log = AuditLog(user_id=user.id, user_email=user.email, action="camera_created",
                   resource_type="camera", resource_id=str(cam.id),
                   details={"name": cam.name}, ip_address=request.client.host if request.client else None)
    db.add(log)

    if cam.is_enabled:
        _start_cam_pipeline(cam)

    return _cam_out(cam)


@router.get("/{camera_id}")
async def get_camera(camera_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    return _cam_out(cam)


def _start_cam_pipeline(cam: Camera):
    from app.vision.stream import create_stream_manager
    from app.vision.detector import get_detector
    from app.vision.tracker import get_tracker
    from app.vision.event_detector import get_event_detector
    from app.vision.pipeline import VisionPipeline, register_pipeline
    from app.services.incident_service import handle_event

    stream = create_stream_manager(str(cam.id), cam.source)
    pipeline = VisionPipeline(
        camera_id=str(cam.id),
        stream=stream,
        detector=get_detector(),
        tracker=get_tracker(str(cam.id)),
        event_detector=get_event_detector(str(cam.id)),
        on_event=lambda ev: handle_event(ev),
    )
    pipeline.start()
    register_pipeline(str(cam.id), pipeline)


@router.patch("/{camera_id}")
async def update_camera(
    camera_id: UUID,
    body: CameraUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    
    from app.vision.pipeline import stop_pipeline

    prev_enabled = cam.is_enabled
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cam, k, v)

    if body.is_enabled is not None and body.is_enabled != prev_enabled:
        if cam.is_enabled:
            cam.status = CameraStatus.online.value
            _start_cam_pipeline(cam)
        else:
            cam.status = CameraStatus.offline.value
            stop_pipeline(str(cam.id))

    log = AuditLog(user_id=user.id, user_email=user.email, action="camera_updated",
                   resource_type="camera", resource_id=str(cam.id),
                   details=body.model_dump(exclude_none=True), ip_address=request.client.host if request.client else None)
    db.add(log)
    return _cam_out(cam)


@router.post("/{camera_id}/toggle")
async def toggle_camera(
    camera_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    """Toggle camera ON (enabled) or OFF (disabled)."""
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")

    from app.vision.pipeline import stop_pipeline

    cam.is_enabled = not cam.is_enabled
    if cam.is_enabled:
        cam.status = CameraStatus.online.value
        _start_cam_pipeline(cam)
    else:
        cam.status = CameraStatus.offline.value
        stop_pipeline(str(cam.id))

    log = AuditLog(
        user_id=user.id,
        user_email=user.email,
        action="camera_toggled",
        resource_type="camera",
        resource_id=str(cam.id),
        details={"is_enabled": cam.is_enabled, "status": cam.status},
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return _cam_out(cam)


@router.delete("/{camera_id}", status_code=204)
async def delete_camera(
    camera_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    
    from app.vision.pipeline import stop_pipeline
    stop_pipeline(str(camera_id))

    await db.delete(cam)
    log = AuditLog(user_id=user.id, user_email=user.email, action="camera_deleted",
                   resource_type="camera", resource_id=str(camera_id),
                   ip_address=request.client.host if request.client else None)
    db.add(log)


@router.post("/{camera_id}/test")
async def test_camera(camera_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_operator)):
    cam = await db.get(Camera, camera_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    import cv2
    source = int(cam.source) if cam.source.isdigit() else cam.source
    cap = cv2.VideoCapture(source)
    opened = cap.isOpened()
    cap.release()
    return {"source": cam.source, "connected": opened}
