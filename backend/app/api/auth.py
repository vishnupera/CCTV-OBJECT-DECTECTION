"""Auth API router — login, logout, refresh, me."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import AuditLog, User
from app.security.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.security.dependencies import get_current_user

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory failed login counter (use Redis in production)
_failed_attempts: dict = {}


class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: Optional[str] = None


class LoginResponse(BaseModel):
    message: str
    role: str
    email: str


async def _write_audit(
    db: AsyncSession,
    action: str,
    user: Optional[User],
    request: Request,
    success: bool,
    details: dict = None,
) -> None:
    log = AuditLog(
        user_id=user.id if user else None,
        user_email=user.email if user else None,
        action=action,
        resource_type="auth",
        details=details or {},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        success=success,
    )
    db.add(log)
    await db.flush()


@router.post("/login", response_model=LoginResponse)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    client_ip = request.client.host if request.client else "unknown"

    # Rate limiting / lockout check
    attempts_key = f"{client_ip}:{req.email}"
    attempts_data = _failed_attempts.get(attempts_key, {"count": 0, "locked_until": None})
    if attempts_data["locked_until"] and datetime.now(timezone.utc) < attempts_data["locked_until"]:
        await _write_audit(db, "login_blocked", None, request, False, {"email": req.email})
        raise HTTPException(status_code=429, detail="Account temporarily locked. Try again later.")

    # Fetch user
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        attempts_data["count"] += 1
        if attempts_data["count"] >= settings.login_max_failures:
            from datetime import timedelta
            attempts_data["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=settings.login_lockout_minutes)
        _failed_attempts[attempts_key] = attempts_data
        await _write_audit(db, "login_failed", user, request, False, {"email": req.email})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    # TOTP check
    if user.totp_enabled:
        if not req.totp_code:
            raise HTTPException(status_code=401, detail="TOTP code required")
        import pyotp
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(req.totp_code, valid_window=1):
            await _write_audit(db, "login_totp_failed", user, request, False)
            raise HTTPException(status_code=401, detail="Invalid TOTP code")

    # Reset failed attempts
    _failed_attempts.pop(attempts_key, None)

    # Issue tokens
    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Set httpOnly cookies
    secure = settings.is_production
    response.set_cookie("access_token", access_token, httponly=True, secure=secure, samesite="lax", max_age=settings.access_token_expire_minutes * 60)
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=secure, samesite="lax", max_age=settings.refresh_token_expire_days * 86400, path="/auth/refresh")

    # Update last login
    await db.execute(update(User).where(User.id == user.id).values(last_login=datetime.now(timezone.utc)))
    await _write_audit(db, "login_success", user, request, True)

    return LoginResponse(message="Login successful", role=user.role, email=user.email)


@router.post("/logout")
async def logout(response: Response, request: Request, db: AsyncSession = Depends(get_db)):
    user = None
    try:
        user = await get_current_user(request, db)
    except Exception:
        pass
    await _write_audit(db, "logout", user, request, True)
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token: Optional[str] = None,
):
    from fastapi import Cookie
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    from uuid import UUID
    result = await db.execute(select(User).where(User.id == UUID(payload["sub"])))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    token_data = {"sub": str(user.id), "role": user.role, "email": user.email}
    new_access = create_access_token(token_data)
    secure = settings.is_production
    response.set_cookie("access_token", new_access, httponly=True, secure=secure, samesite="lax", max_age=settings.access_token_expire_minutes * 60)
    return {"message": "Token refreshed"}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "totp_enabled": user.totp_enabled,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }
