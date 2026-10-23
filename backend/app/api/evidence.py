"""Evidence API router."""
from __future__ import annotations

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from app.database import get_db
from app.models import Evidence
from app.security.dependencies import require_any
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/{evidence_id}")
async def get_evidence_meta(evidence_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    ev = await db.get(Evidence, evidence_id)
    if not ev:
        raise HTTPException(404, "Evidence not found")
    return {
        "id": str(ev.id),
        "incident_id": str(ev.incident_id),
        "evidence_type": ev.evidence_type,
        "file_url": f"/api/evidence/{ev.id}/file",
        "mime_type": ev.mime_type,
        "file_size_bytes": ev.file_size_bytes,
        "created_at": ev.created_at.isoformat(),
    }


@router.delete("/{evidence_id}", status_code=204)
async def delete_evidence(evidence_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    ev = await db.get(Evidence, evidence_id)
    if not ev:
        raise HTTPException(404, "Evidence not found")
    if os.path.exists(ev.file_path):
        os.remove(ev.file_path)
    await db.delete(ev)
