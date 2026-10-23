<<<<<<< HEAD
# SafeWatchAI — AI CCTV Crowd Safety & Incident Detection System

> **MVP Complete** | High-performance AI-assisted CCTV video analytics system combining real-time YOLOv8 object detection, multi-object ByteTrack tracking, spatial zone logic, automated incident detection, evidence clipping, and an operations console with a modern public showcase website.

---

## 🛡️ Executive Summary & Ethics Note

**Human-in-the-Loop Principle**: All automated detections and alerts produced by this system are considered signals for human operator verification. No autonomous law enforcement, punitive, or irreversible physical actions are executed without human confirmation. The system is designed for public safety, crowd management, and incident response.

---

## 📐 Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │             CCTV Camera Feed           │
                      │   (Webcam 0 / RTSP stream / MP4 replay)│
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │         FastAPI Backend Engine         │
                      │  • OpenCV capture + rolling buffer     │
                      │  • YOLOv8 real-time inference (5 FPS)  │
                      │  • ByteTrack multi-object tracker      │
                      │  • Zone polygon & behavior event engine│
                      │  • Evidence capture (clip + snapshots) │
                      │  • Argon2 auth + JWT + RBAC            │
                      │  • WebSocket live alert dispatch       │
                      │  • PostgreSQL + Async SQLAlchemy       │
                      └─────────────┬──────────────┬───────────┘
                                    │              │
                   REST / WebSocket │              │ MJPEG Debug Stream
                                    ▼              ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────────┐
│             Public Website            │  │          Hidden Admin Portal        │
│ • Dark glassmorphic design system     │  │ • Route: /ops-console-a1b2c3       │
│ • Home, Features, Capabilities        │  │ • Live CCTV Monitor + Detections   │
│ • How It Works, Privacy, Contact      │  │ • Incident Review + Evidence Files  │
│ • Fully responsive Vite + Tailwind    │  │ • Cameras & Zone Polygon Editor    │
│ • Modern typography & micro-motion    │  │ • Analytics Charts (Recharts)       │
│                                       │  │ • Users, Audit Logs, System Health │
└───────────────────────────────────────┘  └─────────────────────────────────────┘
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
- **Python 3.10+** (Python 3.11+ recommended)
- **Node.js 18+** & `npm`
- **PostgreSQL 14+** (running on port `5432` with database `cctv_db` and user `cctv:cctvpass`)

### 2. Configure Environment

Copy the `.env.example` to `.env` (or use the preconfigured `.env`):
```bash
cp .env.example .env
```

Ensure `.env` matches your database configuration:
```env
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=5000
FRONTEND_ORIGIN=http://localhost:3000
ADMIN_PATH_SLUG=ops-console-a1b2c3

DATABASE_URL=postgresql+asyncpg://cctv:cctvpass@localhost:5432/cctv_db
DATABASE_URL_SYNC=postgresql://cctv:cctvpass@localhost:5432/cctv_db

JWT_SECRET_KEY=CHANGE_ME_TO_A_LONG_RANDOM_STRING_IN_PRODUCTION
SEED_ADMIN_EMAIL=admin@cctv.local
SEED_ADMIN_PASSWORD=CHANGE_ME_ADMIN_PASSWORD

VIDEO_SOURCE=0
```

### 3. Backend Setup & Run

In a terminal:
```powershell
cd backend
# If venv is not created:
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Start the server (uvicorn)
.\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

On startup, the backend automatically:
1. Connects to PostgreSQL and verifies/creates all 10 relational tables.
2. Seeds the default administrator account (`admin@cctv.local`).
3. Discovers/creates the default camera pipeline and starts YOLOv8 inference.
4. Mounts REST endpoints, MJPEG debug stream, and WebSocket `/ws/alerts`.

Interactive API documentation is accessible at:
- **Swagger UI**: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 4. Frontend Setup & Run

In a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

The frontend will run at:
- **Public Website**: [http://localhost:3000](http://localhost:3000)
- **Hidden Admin Console**: [http://localhost:3000/ops-console-a1b2c3](http://localhost:3000/ops-console-a1b2c3)

---

## 🔑 Default Credentials & Access

| Parameter | Value |
|---|---|
| **Admin Portal URL** | `http://localhost:3000/ops-console-a1b2c3` |
| **Email** | `admin@cctv.local` |
| **Password** | `CHANGE_ME_ADMIN_PASSWORD` |
| **Role** | `admin` (Full access) |

*(Remember to change the admin password upon initial setup in production settings)*

---

## 🎥 Video Input Options

The system supports multiple input modes via the `VIDEO_SOURCE` setting:

1. **Local Webcam**:
   ```env
   VIDEO_SOURCE=0
   ```
2. **Video File Playback (Loops automatically)**:
   ```env
   VIDEO_SOURCE=data/videos/sample.mp4
   ```
3. **RTSP IP Camera**:
   ```env
   VIDEO_SOURCE=rtsp://username:password@192.168.1.100:554/stream1
   ```
4. **Automated Sample Replay Script**:
   Run the sample runner to download a test video and run the pipeline without a webcam:
   ```powershell
   python scripts/replay_sample.py
   ```

---

## 🧩 Completed Phase Breakdown

- **Phase 1: Webcam Detection + Debug MJPEG Stream**
  - OpenCV capture thread with automatic reconnection and FPS throttling.
  - YOLOv8 inference running at configurable target FPS (default: 5 FPS).
  - Multi-part MJPEG stream endpoint `/api/stream/{camera_id}/mjpeg`.
- **Phase 2: Tracking with Persistent IDs**
  - ByteTrack / SORT Kalman filter algorithm assigning stable IDs to people and vehicles.
  - Track ID overlays rendered in real-time on live streams.
  - Rolling 15-second frame buffer for zero-latency pre-incident clipping.
- **Phase 3: Zones, Event Engine & Behavior Rules**
  - Ray-casting polygon containment detection for user-drawn zone masks.
  - Rules: Restricted Zone Intrusion, Crowd Density Spike, Stampede / Sudden Dispersal, Loitering, and Unattended Bags.
  - Rule cooldowns, confidence thresholds, and deduplication logic.
- **Phase 4: Incidents, Evidence & Audit Logging**
  - Immutable audit logs recording all operator actions and logins.
  - Evidence collection capturing full-resolution snapshots, cropped objects, cropped suspects, and 5-second video clips.
  - Unique sequential incident IDs (`INC-YYYY-XXXXX`).
- **Phase 5: Backend Auth, RBAC & Security Hardening**
  - Argon2 password hashing.
  - Short-lived JWT access tokens + rotating refresh tokens.
  - Role-Based Access Control (`admin`, `operator`, `viewer`).
  - Rate limiting, login lockout protections, and security headers (CSP, nosniff, DENY).
  - Robots.txt disallowing search engines from indexing the admin path.
- **Phase 6: Public Website**
  - High-aesthetic dark glassmorphism layout with animated hero, live KPI counters, interactive features showcase, detection capabilities matrix, privacy policy, and contact form.
- **Phase 7: Hidden Admin Operations Portal**
  - Live Monitor with real-time detections and MJPEG feed toggle.
  - Incident management workflow (Review, Acknowledge, Resolve, Mark False Positive with operator notes).
  - Interactive Zone Polygon drawing canvas over live camera feed.
  - Rule threshold editor & Watch-list configuration.
  - Interactive analytics dashboards (Incidents/hour, severity distributions, false-positive metrics via Recharts).
  - User management (Create users, change roles, disable accounts, reset passwords).
  - System health monitor (CPU, RAM, GPU, storage usage, pipeline FPS, database status).
  - WebSocket-powered real-time desktop alert toasts.
- **Phase 8: Hardening & Utilities**
  - Automated evidence file retention cleanup service (`app/services/retention.py`).
  - Sample replay script (`scripts/replay_sample.py`).
  - Structured logging and unified configuration validation.
=======
# CCTV-OBJECT-DECTECTION
>>>>>>> f1f4b578a7a7997b59fbe96fb87556b04fdc81b7
