"""System Health API."""
from __future__ import annotations

import os
import time
from typing import Dict

from fastapi import APIRouter, Depends

from app.config import get_settings
from app.security.dependencies import require_any
from app.vision.pipeline import all_pipelines

router = APIRouter(prefix="/health", tags=["health"])
settings = get_settings()

_start_time = time.time()


@router.get("", include_in_schema=False)
@router.get("/")
async def health_check():
    """Public health check — minimal info."""
    return {"status": "ok", "uptime_seconds": round(time.time() - _start_time)}


@router.get("/full")
async def full_health(user=Depends(require_any)):
    """Full system health for admin panel."""
    import psutil

    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()

    gpu_info = []
    try:
        import GPUtil
        for gpu in GPUtil.getGPUs():
            gpu_info.append({
                "name": gpu.name,
                "load_pct": round(gpu.load * 100, 1),
                "mem_used_mb": round(gpu.memoryUsed),
                "mem_total_mb": round(gpu.memoryTotal),
                "temperature": gpu.temperature,
            })
    except Exception:
        pass

    # Storage
    storage_info = {}
    for d in ["data/evidence/snapshots", "data/evidence/clips"]:
        try:
            total_bytes = sum(
                os.path.getsize(os.path.join(dp, f))
                for dp, dn, filenames in os.walk(d)
                for f in filenames
            )
            storage_info[d] = {"size_mb": round(total_bytes / 1024 / 1024, 2)}
        except Exception:
            storage_info[d] = {"size_mb": 0}

    # DB status
    db_ok = False
    try:
        from app.database import async_engine
        async with async_engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    # Pipelines
    pipeline_states = {}
    for cam_id, pipeline in all_pipelines().items():
        pipeline_states[cam_id] = {
            "fps": pipeline._stream.fps if pipeline._stream else 0,
            "inference_ms": pipeline._detector.last_inference_ms if pipeline._detector else 0,
            "connected": pipeline._stream.is_connected if pipeline._stream else False,
        }

    return {
        "status": "ok",
        "uptime_seconds": round(time.time() - _start_time),
        "cpu_percent": cpu,
        "memory": {
            "total_mb": round(mem.total / 1024 / 1024),
            "used_mb": round(mem.used / 1024 / 1024),
            "percent": mem.percent,
        },
        "gpu": gpu_info,
        "storage": storage_info,
        "database": {"connected": db_ok},
        "custom_model_loaded": settings.custom_model_exists,
        "pipelines": pipeline_states,
    }
