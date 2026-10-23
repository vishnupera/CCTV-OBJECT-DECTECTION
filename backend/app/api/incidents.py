"""Incidents API router."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import AuditLog, Incident, IncidentStatus
from app.security.dependencies import require_any, require_operator

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    operator_notes: Optional[str] = None
    false_positive_reason: Optional[str] = None


def _inc_out(inc: Incident) -> dict:
    return {
        "id": str(inc.id),
        "incident_number": inc.incident_number,
        "camera_id": str(inc.camera_id),
        "location": inc.location,
        "event_type": inc.event_type,
        "severity": inc.severity,
        "status": inc.status,
        "title": inc.title,
        "description": inc.description,
        "rule_triggered": inc.rule_triggered,
        "detected_objects": inc.detected_objects,
        "confidence": inc.confidence,
        "track_ids": inc.track_ids,
        "timestamp": inc.timestamp.isoformat() if inc.timestamp else None,
        "acknowledged_at": inc.acknowledged_at.isoformat() if inc.acknowledged_at else None,
        "operator_notes": inc.operator_notes,
        "false_positive_reason": inc.false_positive_reason,
        "evidence_count": len(inc.evidence_files) if inc.evidence_files else 0,
    }


@router.get("/")
async def list_incidents(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    camera_id: Optional[str] = None,
    event_type: Optional[str] = None,
    search: Optional[str] = None,
):
    q = select(Incident).options(selectinload(Incident.evidence_files)).order_by(Incident.timestamp.desc())
    if status:
        q = q.where(Incident.status == status)
    if severity:
        q = q.where(Incident.severity == severity)
    if camera_id:
        q = q.where(Incident.camera_id == UUID(camera_id))
    if event_type:
        q = q.where(Incident.event_type == event_type)
    if search:
        q = q.where(Incident.incident_number.ilike(f"%{search}%"))

    total_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(total_q)).scalar_one()

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    incidents = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_inc_out(i) for i in incidents],
    }


@router.get("/{incident_id}")
async def get_incident(incident_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    result = await db.execute(
        select(Incident)
        .options(selectinload(Incident.evidence_files), selectinload(Incident.camera))
        .where(Incident.id == incident_id)
    )
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(404, "Incident not found")
    data = _inc_out(inc)
    data["camera_name"] = inc.camera.name if inc.camera else None
    data["evidence"] = [
        {
            "id": str(e.id),
            "type": e.evidence_type,
            "url": f"/api/evidence/{e.id}",
            "mime_type": e.mime_type,
            "created_at": e.created_at.isoformat(),
        }
        for e in (inc.evidence_files or [])
    ]
    return data


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: UUID,
    body: IncidentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    inc = await db.get(Incident, incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")

    if body.status == IncidentStatus.false_positive and not body.false_positive_reason:
        raise HTTPException(400, "false_positive_reason is required when marking as false positive")

    if body.status:
        inc.status = body.status
        if body.status == IncidentStatus.acknowledged:
            from datetime import datetime, timezone
            inc.acknowledged_by = user.id
            inc.acknowledged_at = datetime.now(timezone.utc)

    if body.operator_notes is not None:
        inc.operator_notes = body.operator_notes
    if body.false_positive_reason is not None:
        inc.false_positive_reason = body.false_positive_reason

    log = AuditLog(
        user_id=user.id, user_email=user.email,
        action="incident_updated", resource_type="incident", resource_id=str(incident_id),
        details=body.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return _inc_out(inc)


@router.get("/stats/summary")
async def incident_stats(db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    """Summary stats for dashboard KPI cards."""
    from datetime import datetime, timezone, timedelta
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_today = (await db.execute(
        select(func.count()).where(Incident.timestamp >= today)
    )).scalar_one()

    pending = (await db.execute(
        select(func.count()).where(Incident.status == IncidentStatus.pending_review)
    )).scalar_one()

    critical_today = (await db.execute(
        select(func.count()).where(Incident.timestamp >= today, Incident.severity == "critical")
    )).scalar_one()

    return {
        "total_today": total_today,
        "pending_review": pending,
        "critical_today": critical_today,
    }
