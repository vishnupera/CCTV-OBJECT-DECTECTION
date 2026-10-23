"""Initialize camera state on application startup (all start in OFF state)."""
from __future__ import annotations

import logging
from sqlalchemy import select, update

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import Camera, CameraStatus

logger = logging.getLogger(__name__)
settings = get_settings()


async def start_default_camera() -> None:
    """
    Ensure a default camera exists in the database in a powered-OFF state.
    Do NOT automatically open the camera hardware or start the vision pipeline on boot.
    The camera stream will only be started when an admin logs in and toggles the camera ON.
    """
    async with AsyncSessionLocal() as db:
        # Check for existing cameras
        result = await db.execute(select(Camera).limit(1))
        cam = result.scalar_one_or_none()

        if not cam:
            # Create default camera from VIDEO_SOURCE in powered OFF state
            cam = Camera(
                name="Default Camera",
                description="Auto-created from VIDEO_SOURCE environment variable",
                source=settings.video_source,
                location="Main Area",
                status=CameraStatus.offline.value,
                is_enabled=False,
            )
            db.add(cam)
            await db.commit()
            logger.info("Created default camera (%s) in powered OFF state.", cam.name)
        else:
            # Ensure cameras start in OFF state on system boot
            await db.execute(
                update(Camera).values(is_enabled=False, status=CameraStatus.offline.value)
            )
            await db.commit()
            logger.info("Cameras initialized in powered OFF state. Awaiting admin activation.")
