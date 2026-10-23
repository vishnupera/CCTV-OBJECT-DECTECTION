"""
Incident creation service.
Called from VisionPipeline when an event fires.
Creates Incident + Evidence records and queues real-time alerts.
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from uuid import UUID, uuid4

import cv2
import numpy as np

from app.config import get_settings
from app.vision.event_detector import DetectedEvent

logger = logging.getLogger(__name__)
settings = get_settings()

# Module-level alert broadcaster (set from main.py)
_alert_broadcaster = None


def set_alert_broadcaster(broadcaster) -> None:
    global _alert_broadcaster
    _alert_broadcaster = broadcaster


async def _create_incident_db(event: DetectedEvent, evidence_files: List[Dict]) -> Optional[str]:
    """Create incident + evidence in the database."""
    try:
        from app.database import AsyncSessionLocal
        from app.models import Evidence, Incident

        async with AsyncSessionLocal() as db:
            # Generate incident number: INC-2024-00001
            year = datetime.now().year
            from sqlalchemy import func, select
            count = (await db.execute(
                select(func.count()).where(
                    Incident.incident_number.like(f"INC-{year}-%")
                )
            )).scalar_one()
            incident_number = f"INC-{year}-{count + 1:05d}"

            # Get camera location
            location = None
            try:
                from app.models import Camera
                cam = (await db.execute(
                    select(Camera).where(Camera.id == UUID(event.camera_id))
                )).scalar_one_or_none()
                if cam:
                    location = cam.location
            except Exception:
                pass

            inc = Incident(
                incident_number=incident_number,
                camera_id=UUID(event.camera_id),
                location=location,
                event_type=event.event_type,
                severity=event.severity,
                rule_triggered=event.rule_triggered,
                detected_objects=event.detected_objects,
                confidence=event.confidence,
                track_ids=event.track_ids,
                zone_id=UUID(event.zone_id) if event.zone_id else None,
                timestamp=datetime.fromtimestamp(event.timestamp, tz=timezone.utc),
                title="Potential security incident detected.",
                description=f"Rule '{event.rule_triggered}' triggered on camera. "
                            "All detections are signals for human review, not proof.",
            )
            db.add(inc)
            await db.flush()

            for ev_file in evidence_files:
                ev = Evidence(
                    incident_id=inc.id,
                    evidence_type=ev_file["type"],
                    file_path=ev_file["path"],
                    file_size_bytes=ev_file.get("size"),
                    mime_type=ev_file.get("mime_type", "image/jpeg"),
                )
                db.add(ev)

            await db.commit()
            logger.info("Incident created: %s (%s)", incident_number, event.event_type)
            return incident_number

    except Exception as exc:
        logger.error("Failed to create incident: %s", exc, exc_info=True)
        return None


def _save_snapshot(frame: np.ndarray, incident_id: str) -> Optional[Dict]:
    """Save full-frame snapshot to disk."""
    try:
        Path(settings.evidence_snapshots_dir).mkdir(parents=True, exist_ok=True)
        filename = f"{incident_id}_snapshot.jpg"
        path = os.path.join(settings.evidence_snapshots_dir, filename)
        cv2.imwrite(path, frame)
        size = os.path.getsize(path)
        return {"type": "snapshot", "path": path, "size": size, "mime_type": "image/jpeg"}
    except Exception as exc:
        logger.error("Failed to save snapshot: %s", exc)
        return None


def _save_cropped(frame: np.ndarray, bbox: Dict, incident_id: str, suffix: str) -> Optional[Dict]:
    """Crop a region from the frame and save."""
    try:
        x1 = max(0, bbox.get("x1", 0))
        y1 = max(0, bbox.get("y1", 0))
        x2 = min(frame.shape[1], bbox.get("x2", frame.shape[1]))
        y2 = min(frame.shape[0], bbox.get("y2", frame.shape[0]))
        if x2 <= x1 or y2 <= y1:
            return None
        crop = frame[y1:y2, x1:x2]
        Path(settings.evidence_snapshots_dir).mkdir(parents=True, exist_ok=True)
        filename = f"{incident_id}_{suffix}.jpg"
        path = os.path.join(settings.evidence_snapshots_dir, filename)
        cv2.imwrite(path, crop)
        size = os.path.getsize(path)
        return {"type": suffix, "path": path, "size": size, "mime_type": "image/jpeg"}
    except Exception as exc:
        logger.error("Failed to save crop: %s", exc)
        return None


def _save_clip(frames_with_ts: list, incident_id: str) -> Optional[Dict]:
    """Save a short video clip from the frame buffer."""
    try:
        if not frames_with_ts:
            return None
        Path(settings.evidence_clips_dir).mkdir(parents=True, exist_ok=True)
        filename = f"{incident_id}_clip.mp4"
        path = os.path.join(settings.evidence_clips_dir, filename)

        h, w = frames_with_ts[0][1].shape[:2]
        fourcc = cv2.VideoWriter.fourcc(*"mp4v")
        writer = cv2.VideoWriter(path, fourcc, settings.inference_fps, (w, h))
        for _, f in frames_with_ts:
            writer.write(f)
        writer.release()

        size = os.path.getsize(path)
        return {"type": "clip", "path": path, "size": size, "mime_type": "video/mp4"}
    except Exception as exc:
        logger.error("Failed to save clip: %s", exc)
        return None


# Main asyncio event loop (set from main.py startup)
_main_loop: Optional[asyncio.AbstractEventLoop] = None


def set_main_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _main_loop
    _main_loop = loop


def handle_event(event: DetectedEvent) -> None:
    """
    Synchronous handler called from VisionPipeline thread.
    Schedules async DB write safely on the main event loop.
    """
    try:
        global _main_loop
        if _main_loop and _main_loop.is_running():
            asyncio.run_coroutine_threadsafe(_process_event(event), _main_loop)
        else:
            import threading
            threading.Thread(target=lambda: asyncio.run(_process_event(event)), daemon=True).start()
    except Exception as exc:
        logger.error("Event handling error: %s", exc)


async def _process_event(event: DetectedEvent) -> None:
    """Async event processing: save evidence and create incident."""
    incident_id = str(uuid4())
    evidence_files = []

    # Get frames from buffer
    from app.vision.stream import get_stream_manager
    try:
        stream = get_stream_manager(event.camera_id)
        frames_with_ts = stream.frame_buffer.get_window(5.0, 5.0, event.timestamp)

        # Get current frame for snapshot/crops
        latest = stream.frame_buffer.latest()
        if latest:
            frame = latest[1]
            snap = _save_snapshot(frame, incident_id)
            if snap:
                evidence_files.append(snap)

            # Crop detected objects
            for obj in (event.detected_objects or []):
                bbox = obj.get("bbox")
                if bbox:
                    class_name = obj.get("class_name", "object")
                    crop = _save_cropped(frame, bbox, incident_id, f"cropped_{class_name}")
                    if crop:
                        crop["type"] = "cropped_object"
                        evidence_files.append(crop)

        clip = _save_clip(frames_with_ts, incident_id)
        if clip:
            evidence_files.append(clip)
    except Exception as exc:
        logger.warning("Could not get frames for evidence: %s", exc)

    incident_number = await _create_incident_db(event, evidence_files)

    # Broadcast real-time alert
    if _alert_broadcaster and incident_number:
        try:
            await _alert_broadcaster({
                "type": "new_incident",
                "incident_number": incident_number,
                "event_type": event.event_type,
                "severity": event.severity,
                "camera_id": event.camera_id,
                "timestamp": event.timestamp,
                "title": "Potential security incident detected.",
            })
        except Exception as exc:
            logger.warning("Alert broadcast failed: %s", exc)
