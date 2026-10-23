"""Rules & Watch-list API router."""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import AuditLog, RuleConfig
from app.security.dependencies import require_any, require_operator
from app.vision.event_detector import get_watchlist

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/rules", tags=["rules"])


class RuleUpdate(BaseModel):
    enabled: bool = None
    confidence: float = None
    consecutive_seconds: int = None
    cooldown_seconds: int = None
    tier: str = None


@router.get("/watchlist")
async def get_watchlist_config(_=Depends(require_any)):
    """Return current watchlist config from YAML + DB overrides."""
    wl = get_watchlist()
    return {
        "classes": wl.get("classes", []),
        "rules": wl.get("rules", {}),
        "custom_model_loaded": settings.custom_model_exists,
        "custom_model_path": settings.custom_model_path,
    }


@router.get("/db-config")
async def get_db_rule_configs(db: AsyncSession = Depends(get_db), _=Depends(require_any)):
    result = await db.execute(select(RuleConfig).order_by(RuleConfig.class_name))
    configs = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "class_name": c.class_name,
            "label": c.label,
            "source": c.source,
            "tier": c.tier,
            "confidence": c.confidence,
            "consecutive_seconds": c.consecutive_seconds,
            "cooldown_seconds": c.cooldown_seconds,
            "enabled": c.enabled,
            "notes": c.notes,
        }
        for c in configs
    ]


@router.patch("/db-config/{class_name}")
async def update_rule_config(
    class_name: str,
    body: RuleUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_operator),
):
    result = await db.execute(select(RuleConfig).where(RuleConfig.class_name == class_name))
    cfg = result.scalar_one_or_none()
    if not cfg:
        raise HTTPException(404, f"Rule config for '{class_name}' not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cfg, k, v)
    log = AuditLog(
        user_id=user.id, user_email=user.email,
        action="rule_config_updated", resource_type="rule_config", resource_id=class_name,
        details=body.model_dump(exclude_none=True),
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    return {"message": "Rule config updated", "class_name": class_name}
