# AI CCTV Crowd Safety & Incident Detection System - Build Progress

## Phase 1: Webcam Detection + Debug MJPEG Stream
- [x] Project folder structure created
- [x] Docker Compose / Local PostgreSQL database configured
- [x] Python virtual environment + requirements.txt
- [x] OpenCV video capture with configurable VIDEO_SOURCE
- [x] YOLOv8n inference on frames (CPU/GPU auto)
- [x] Watch-list config YAML
- [x] MJPEG debug stream endpoint (FastAPI)
- [x] .env.example
- [x] Phase 1 smoke test passing

## Phase 2: Tracking with Persistent IDs
- [x] ByteTrack / SORT integration
- [x] Track ID overlay on MJPEG stream
- [x] Rolling frame buffer (for evidence clips)
- [x] Phase 2 smoke test passing

## Phase 3: Zones + Event Engine + Watch-list + Behavior Rules
- [x] CameraZone model (polygon JSON)
- [x] Zone intrusion rule
- [x] Crowd density spike rule
- [x] Sudden movement / stampede rule
- [x] Loitering rule
- [x] Unattended bag rule
- [x] Watch-list config: tiers, thresholds, cooldowns, consecutive-seconds
- [x] Custom model hook
- [x] Event deduplication and cooldown
- [x] Phase 3 smoke test passing

## Phase 4: Incidents + Evidence + Database + Audit Log
- [x] SQLAlchemy models (all 10 tables)
- [x] Database migrations & schema generation
- [x] PostgreSQL database configured and running
- [x] Incident ID format: INC-YYYY-00001
- [x] Evidence: snapshot, cropped object, cropped person, 5s clip
- [x] Authenticated evidence endpoints
- [x] Incident creation service
- [x] AuditLog on every action
- [x] Seed script
- [x] Phase 4 smoke test passing

## Phase 5: Backend Auth, Roles, Hidden-Route, Rate Limiting
- [x] Argon2 password hashing
- [x] JWT access + refresh tokens (httpOnly cookies)
- [x] CSRF protection
- [x] Roles: admin, operator, viewer (backend enforced)
- [x] Rate limiting + lockout
- [x] ADMIN_PATH_SLUG env var
- [x] Security headers
- [x] CORS locked
- [x] robots.txt + noindex meta
- [x] Phase 5 smoke test passing

## Phase 6: Public Website
- [x] Vite + React + TypeScript + Tailwind CSS
- [x] Design system
- [x] Home, Features, How It Works, Detection Capabilities, Privacy, Contact pages
- [x] Responsive
- [x] Phase 6 smoke test passing

## Phase 7: Admin Portal + WebSocket Dashboard + Analytics
- [x] Hidden admin route
- [x] Login page
- [x] Dashboard (camera list, live feed, incidents, KPIs)
- [x] Live Monitor
- [x] Incidents table + detail + actions
- [x] Cameras CRUD
- [x] Zones canvas editor
- [x] Rules & Watch-list
- [x] Analytics (Recharts)
- [x] Users & Roles
- [x] Audit Log view
- [x] System Health
- [x] Settings
- [x] Real-time toasts via WebSocket
- [x] Phase 7 smoke test passing

## Phase 8: Hardening + Documentation
- [x] /health endpoint
- [x] Evidence retention job
- [x] Structured JSON logging
- [x] Config validation on startup
- [x] README.md complete
- [x] .env.example complete
- [x] Sample MP4 replay script
- [x] Phase 8 complete
