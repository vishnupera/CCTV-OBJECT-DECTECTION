"""FastAPI dependencies for authentication and authorization."""
from __future__ import annotations

import logging
from typing import Optional
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, UserRole
from app.security.auth import decode_token

logger = logging.getLogger(__name__)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    access_token: Optional[str] = Cookie(default=None),
) -> User:
    """Extract and validate JWT from httpOnly cookie."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )

    token = access_token
    # Also check Authorization header for WebSocket / API clients
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise credentials_exception

    return user


def require_role(*roles: str):
    """Dependency factory that enforces one of the given roles."""
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' cannot perform this action.",
            )
        return user
    return _check


require_admin = require_role(UserRole.admin)
require_operator = require_role(UserRole.admin, UserRole.operator)
require_any = require_role(UserRole.admin, UserRole.operator, UserRole.viewer)
