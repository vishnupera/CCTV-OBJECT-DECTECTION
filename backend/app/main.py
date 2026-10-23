"""
Main FastAPI application.
- Applies security headers
- Registers all routers
- Initialises vision pipeline on startup
- WebSocket endpoint for real-time alerts
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.api import auth, cameras, incidents, analytics, users, audit, zones, health, stream, evidence, rules
from app.websocket.manager import get_ws_manager
from app.services.incident_service import set_alert_broadcaster
from app.security.auth import decode_token

settings = get_settings()

# Configure structured logging
logging.basicConfig(level=logging.INFO)
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.dev.ConsoleRenderer() if settings.app_env != "production" else structlog.processors.JSONRenderer(),
    ]
)
logger = logging.getLogger(__name__)


# ── Startup / Shutdown ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create evidence directories
    for d in [settings.evidence_snapshots_dir, settings.evidence_clips_dir]:
        Path(d).mkdir(parents=True, exist_ok=True)

    # Run DB migrations / create tables
    try:
        from app.database import async_engine
        from app.models import Base
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified/created.")
    except Exception as exc:
        logger.error("DB init error: %s", exc)

    # Seed initial admin user
    try:
        from app.services.seed import seed_admin
        await seed_admin()
    except Exception as exc:
        logger.error("Seed error: %s", exc)

    # Set main event loop for thread-safe incident creation
    try:
        import asyncio
        from app.services.incident_service import set_main_loop
        set_main_loop(asyncio.get_running_loop())
    except Exception as exc:
        logger.warning("Could not set main loop: %s", exc)

    # Load default camera (from VIDEO_SOURCE env) and start pipeline
    try:
        from app.services.camera_startup import start_default_camera
        await start_default_camera()
    except Exception as exc:
        logger.warning("Default camera startup error: %s", exc)

    # Connect alert broadcaster to WebSocket manager
    ws_manager = get_ws_manager()
    set_alert_broadcaster(ws_manager.broadcast)

    logger.info("🚀 CCTV AI System started | Admin path: /%s", settings.admin_path_slug)
    yield

    # Cleanup
    from app.vision.pipeline import all_pipelines
    for pipeline in all_pipelines().values():
        pipeline.stop()
    logger.info("All pipelines stopped.")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="CCTV AI Safety System",
    description="AI-assisted crowd safety and incident detection. All detections are signals for human review.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.app_env != "production" else None,
    redoc_url=None,
)

# CORS — locked to frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers middleware ────────────────────────────────────────────────

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Admin IP allowlist middleware ──────────────────────────────────────────────

@app.middleware("http")
async def admin_ip_check(request: Request, call_next):
    path = request.url.path
    admin_prefix = f"/{settings.admin_path_slug}"
    if path.startswith(admin_prefix) or path.startswith("/api/"):
        from app.security.auth import check_ip_allowlist
        client_ip = request.client.host if request.client else "0.0.0.0"
        if not check_ip_allowlist(client_ip):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
    return await call_next(request)


# ── Robots.txt ────────────────────────────────────────────────────────────────

@app.get("/robots.txt", include_in_schema=False)
async def robots_txt():
    content = f"User-agent: *\nDisallow: /{settings.admin_path_slug}/\nDisallow: /api/\n"
    return JSONResponse(content=content, media_type="text/plain")


# ── API Routers ────────────────────────────────────────────────────────────────

API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(cameras.router, prefix=API_PREFIX)
app.include_router(incidents.router, prefix=API_PREFIX)
app.include_router(analytics.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(audit.router, prefix=API_PREFIX)
app.include_router(zones.router, prefix=API_PREFIX)
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(stream.router, prefix=API_PREFIX)
app.include_router(evidence.router, prefix=API_PREFIX)
app.include_router(rules.router, prefix=API_PREFIX)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@app.websocket("/ws/alerts")
async def ws_alerts(websocket: WebSocket):
    """Real-time alert WebSocket. Accepts JWT in query param for WS auth."""
    token = websocket.query_params.get("token")
    if token:
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            return
    else:
        # Also check cookie
        token = websocket.cookies.get("access_token")
        if not token:
            await websocket.close(code=4001)
            return
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001)
            return

    manager = get_ws_manager()
    await manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await manager.send_to(websocket, {"type": "connected", "message": "Alert stream active"})
        while True:
            # Keep connection alive, client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await manager.send_to(websocket, {"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(websocket)


# ── Evidence endpoint (authenticated file serving) ────────────────────────────

@app.get("/api/evidence/{evidence_id}/file")
async def serve_evidence_file(evidence_id: str, request: Request):
    """Serve evidence files — authentication required."""
    from app.security.dependencies import get_current_user
    from app.database import AsyncSessionLocal
    from app.models import Evidence
    from uuid import UUID

    token = request.cookies.get("access_token")
    if not token:
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token or not decode_token(token):
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})

    async with AsyncSessionLocal() as db:
        ev = await db.get(Evidence, UUID(evidence_id))
        if not ev:
            return JSONResponse(status_code=404, content={"detail": "Evidence not found"})
        if not os.path.exists(ev.file_path):
            return JSONResponse(status_code=404, content={"detail": "Evidence file not found on disk"})
        return FileResponse(ev.file_path, media_type=ev.mime_type or "application/octet-stream")
