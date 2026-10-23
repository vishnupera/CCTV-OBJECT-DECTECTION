"""
Application settings loaded from environment variables.
All secrets and config live in .env — no hardcoded values.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 5001
    frontend_origin: str = "http://localhost:3000"

    # ── Admin hidden route ────────────────────────────────────────────────────
    admin_path_slug: str = "ops-console-a1b2c3"

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://cctv:cctvpass@localhost:5432/cctv_db"
    database_url_sync: str = "postgresql://cctv:cctvpass@localhost:5432/cctv_db"

    # ── JWT ──────────────────────────────────────────────────────────────────
    jwt_secret_key: str = "insecure-dev-key-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── Video ─────────────────────────────────────────────────────────────────
    video_source: str = "0"
    inference_fps: int = 5
    frame_resize_width: int = 640
    frame_buffer_seconds: int = 15

    # ── Models ───────────────────────────────────────────────────────────────
    yolo_base_model: str = "yolov8n.pt"
    custom_model_path: str = "models/yolo/custom.pt"

    # ── Storage ──────────────────────────────────────────────────────────────
    evidence_snapshots_dir: str = "data/evidence/snapshots"
    evidence_clips_dir: str = "data/evidence/clips"
    evidence_retention_days: int = 30

    # ── Seed admin ───────────────────────────────────────────────────────────
    seed_admin_email: str = "admin@cctv.local"
    seed_admin_password: str = "CHANGE_ME_ADMIN_PASSWORD"

    # ── IP Allowlist ─────────────────────────────────────────────────────────
    admin_ip_allowlist: Optional[str] = None

    # ── Rate limiting ─────────────────────────────────────────────────────────
    login_rate_limit_per_minute: int = 10
    login_max_failures: int = 5
    login_lockout_minutes: int = 15

    # ── Watchlist config path ─────────────────────────────────────────────────
    watchlist_config_path: str = "backend/watchlist.yaml"

    @property
    def admin_ip_allowlist_parsed(self) -> List[str]:
        if not self.admin_ip_allowlist:
            return []
        return [cidr.strip() for cidr in self.admin_ip_allowlist.split(",") if cidr.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def custom_model_exists(self) -> bool:
        return Path(self.custom_model_path).exists()


@lru_cache()
def get_settings() -> Settings:
    return Settings()
