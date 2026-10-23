"""Audit Log API router."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog
from app.security.dependencies import require_admin

router = APIRouter(prefix="/audit", tags=["audit"])


def _log_out(log: AuditLog) -> dict:
    return {
        "id": str(log.id),
        "user_email": log.user_email,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "details": log.details,
        "ip_address": log.ip_address,
        "success": log.success,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
    }


@router.get("/")
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
):
    q = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if action:
        q = q.where(AuditLog.action.ilike(f"%{action}%"))
    if user_email:
        q = q.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    if since:
        q = q.where(AuditLog.timestamp >= since)
    if until:
        q = q.where(AuditLog.timestamp <= until)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    logs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_log_out(l) for l in logs],
    }
