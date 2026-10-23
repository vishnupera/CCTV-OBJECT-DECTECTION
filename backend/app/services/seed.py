"""Seed script — creates the first admin user from env vars."""
from __future__ import annotations

import logging

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.security.auth import hash_password
from sqlalchemy import select

logger = logging.getLogger(__name__)
settings = get_settings()


async def seed_admin() -> None:
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(
            select(User).where(User.email == settings.seed_admin_email)
        )).scalar_one_or_none()

        if existing:
            logger.info("Admin user already exists: %s", settings.seed_admin_email)
            return

        if settings.seed_admin_password == "CHANGE_ME_ADMIN_PASSWORD":
            logger.warning(
                "⚠️  SEED_ADMIN_PASSWORD is default. Set it in .env before going to production!"
            )

        admin = User(
            email=settings.seed_admin_email,
            hashed_password=hash_password(settings.seed_admin_password),
            full_name="System Administrator",
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("✅ Admin user created: %s", settings.seed_admin_email)
