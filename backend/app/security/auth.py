"""Security utilities: password hashing, JWT tokens, CSRF."""
from __future__ import annotations

import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["argon2", "bcrypt"], deprecated="auto")


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: Dict[str, Any]) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        return None


# ── CSRF ──────────────────────────────────────────────────────────────────────

def generate_csrf_token() -> str:
    return secrets.token_hex(32)


# ── IP allowlist ──────────────────────────────────────────────────────────────

def check_ip_allowlist(client_ip: str) -> bool:
    """Return True if allowed. If no allowlist configured, always True."""
    allowed = settings.admin_ip_allowlist_parsed
    if not allowed:
        return True
    import ipaddress
    try:
        client = ipaddress.ip_address(client_ip)
        for cidr in allowed:
            network = ipaddress.ip_network(cidr, strict=False)
            if client in network:
                return True
        return False
    except ValueError:
        return False
