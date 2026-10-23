"""Database session and engine setup."""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

settings = get_settings()

# Async engine for FastAPI endpoints
async_engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Sync engine for Alembic and seed scripts (optional, if psycopg2 is available)
try:
    sync_engine = create_engine(
        settings.database_url_sync.replace("postgresql://", "postgresql+psycopg2://"),
        echo=False,
        pool_pre_ping=True,
    )
    SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False)
except Exception:
    sync_engine = None
    SyncSessionLocal = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
