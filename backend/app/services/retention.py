"""
Evidence retention job — deletes evidence files older than EVIDENCE_RETENTION_DAYS.
Can be run as a scheduled task or from within the FastAPI app via startup.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def run_retention_job() -> None:
    """Delete old evidence files from disk and their DB records."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.evidence_retention_days)
    logger.info("Running retention job. Cutoff: %s", cutoff.isoformat())

    try:
        from app.database import AsyncSessionLocal
        from app.models import Evidence
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Evidence).where(Evidence.created_at < cutoff)
            )
            old_evidence = result.scalars().all()
            deleted_files = 0
            deleted_records = 0

            for ev in old_evidence:
                if ev.file_path and os.path.exists(ev.file_path):
                    try:
                        os.remove(ev.file_path)
                        deleted_files += 1
                    except Exception as e:
                        logger.warning("Could not delete %s: %s", ev.file_path, e)
                await db.delete(ev)
                deleted_records += 1

            await db.commit()
            logger.info(
                "Retention job complete: deleted %d files, %d records",
                deleted_files, deleted_records
            )
    except Exception as exc:
        logger.error("Retention job error: %s", exc, exc_info=True)


if __name__ == "__main__":
    import asyncio
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    asyncio.run(run_retention_job())
