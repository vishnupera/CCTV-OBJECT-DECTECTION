"""Users API router."""
from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AuditLog, User, UserRole
from app.security.auth import hash_password
from app.security.dependencies import require_admin, require_any

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    role: str = UserRole.viewer


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str


def _user_out(u: User) -> dict:
    return {
        "id": str(u.id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "totp_enabled": u.totp_enabled,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat(),
    }


@router.get("/")
async def list_users(db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.email))
    return [_user_out(u) for u in result.scalars().all()]


@router.post("/", status_code=201)
async def create_user(
    body: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
    )
    db.add(user)
    await db.flush()
    log = AuditLog(user_id=admin.id, user_email=admin.email, action="user_created",
                   resource_type="user", resource_id=str(user.id), details={"email": user.email, "role": user.role},
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    return _user_out(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    log = AuditLog(user_id=admin.id, user_email=admin.email, action="user_updated",
                   resource_type="user", resource_id=str(user_id), details=body.model_dump(exclude_none=True),
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    return _user_out(user)


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: UUID,
    body: PasswordReset,
    request: Request,
    db: AsyncSession = Depends(get_db),
    admin=Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    user.hashed_password = hash_password(body.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    log = AuditLog(user_id=admin.id, user_email=admin.email, action="password_reset",
                   resource_type="user", resource_id=str(user_id),
                   ip_address=request.client.host if request.client else None)
    db.add(log)
    return {"message": "Password reset successfully"}
