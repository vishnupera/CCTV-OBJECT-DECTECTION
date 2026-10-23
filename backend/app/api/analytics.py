"""Analytics API router."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Incident
from app.security.dependencies import require_any

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/incidents-per-hour")
async def incidents_per_hour(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    hours: int = Query(24, ge=1, le=168),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(
            func.date_trunc("hour", Incident.timestamp).label("hour"),
            func.count().label("count"),
        )
        .where(Incident.timestamp >= since)
        .group_by("hour")
        .order_by("hour")
    )
    rows = result.all()
    return [{"hour": r.hour.isoformat(), "count": r.count} for r in rows]


@router.get("/by-type")
async def incidents_by_type(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    days: int = Query(7, ge=1, le=90),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Incident.event_type, func.count().label("count"))
        .where(Incident.timestamp >= since)
        .group_by(Incident.event_type)
        .order_by(func.count().desc())
    )
    return [{"event_type": r.event_type, "count": r.count} for r in result.all()]


@router.get("/by-severity")
async def incidents_by_severity(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    days: int = Query(7, ge=1, le=90),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Incident.severity, func.count().label("count"))
        .where(Incident.timestamp >= since)
        .group_by(Incident.severity)
    )
    return [{"severity": r.severity, "count": r.count} for r in result.all()]


@router.get("/by-camera")
async def incidents_by_camera(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    days: int = Query(7, ge=1, le=90),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    from app.models import Camera
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(
            func.cast(Incident.camera_id, __import__("sqlalchemy").String).label("camera_id"),
            func.count().label("count"),
        )
        .where(Incident.timestamp >= since)
        .group_by(Incident.camera_id)
        .order_by(func.count().desc())
    )
    return [{"camera_id": r.camera_id, "count": r.count} for r in result.all()]


@router.get("/false-positive-rate")
async def false_positive_rate(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_any),
    days: int = Query(30, ge=1, le=365),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(
            Incident.event_type,
            func.count().label("total"),
            func.sum(
                __import__("sqlalchemy").case((Incident.status == "false_positive", 1), else_=0)
            ).label("fp_count"),
        )
        .where(Incident.timestamp >= since)
        .group_by(Incident.event_type)
    )
    rows = result.all()
    return [
        {
            "event_type": r.event_type,
            "total": r.total,
            "fp_count": r.fp_count or 0,
            "fp_rate": round((r.fp_count or 0) / max(1, r.total), 4),
        }
        for r in rows
    ]
