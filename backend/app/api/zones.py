"""Zones API router."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog, Camera, CameraZone
from app.security.dependencies import require_any, require_operator

router = APIRouter(prefix="/zones", tags=["zones"])


class ZoneCreate(BaseModel):
    camera_id: str
    name: str
    polygon: Dict[str, Any]  # {"points": [[x,y], ...]}
    rule_type: str
    thresholds: Optional[Dict] = None
    color: Optional[str] = "#2A835F"
    is_active: bool = True


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    polygon: Optional[Dict] = None
    rule_type: Optional[str] = None
    thresholds: Optional[Dict] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


def _zone_out(z: CameraZone) -> dict:
    return {
        "id": str(z.id),
        "camera_id": str(z.camera_id),
        "name": z.name,
        "polygon": z.polygon,
        "rule_type": z.rule_type,
        "thresholds": z.thresholds,
        "is_active": z.is_active,
        "color": z.color,
    }


@router.get("/")
async def list_zones(
    camera_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
):
    q = select(CameraZone)
    if camera_id:
        q = q.where(CameraZone.camera_id == UUID(camera_id))
    result = await db.execute(q)
    zones = result.scalars().all()

    # Update event detector zones
    from app.vision.event_detector import get_event_detector
    if camera_id:
        ed = get_event_detector(camera_id)
        ed.set_zones([_zone_out(z) for z in zones if z.is_active])

    return [_zone_out(z) for z in zones]


@router.post("/", status_code=201)
async def create_zone(
    body: ZoneCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    zone = CameraZone(
        camera_id=UUID(body.camera_id),
        name=body.name,
        polygon=body.polygon,
        rule_type=body.rule_type,
        thresholds=body.thresholds,
        color=body.color,
        is_active=body.is_active,
    )
    db.add(zone)
    await db.flush()
    log = AuditLog(user_id=user.id, user_email=user.email, action="zone_created",
                   resource_type="zone", resource_id=str(zone.id),
                   details={"name": zone.name, "rule_type": zone.rule_type},
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    return _zone_out(zone)


@router.patch("/{zone_id}")
async def update_zone(
    zone_id: UUID,
    body: ZoneUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    zone = await db.get(CameraZone, zone_id)
    if not zone:
        raise HTTPException(404, "Zone not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(zone, k, v)
    log = AuditLog(user_id=user.id, user_email=user.email, action="zone_updated",
                   resource_type="zone", resource_id=str(zone_id),
                   details=body.model_dump(exclude_none=True),
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    return _zone_out(zone)


@router.delete("/{zone_id}", status_code=204)
async def delete_zone(
    zone_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    zone = await db.get(CameraZone, zone_id)
    if not zone:
        raise HTTPException(404, "Zone not found")
    await db.delete(zone)
    log = AuditLog(user_id=user.id, user_email=user.email, action="zone_deleted",
                   resource_type="zone", resource_id=str(zone_id),
                   ip_address=request.client.host if request.client else None)
    db.add(log)
