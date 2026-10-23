"""SQLAlchemy ORM models for all database tables."""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# ─── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    admin = "admin"
    operator = "operator"
    viewer = "viewer"


class IncidentStatus(str, Enum):
    pending_review = "pending_review"
    acknowledged = "acknowledged"
    escalated = "escalated"
    false_positive = "false_positive"


class IncidentSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CameraStatus(str, Enum):
    online = "online"
    offline = "offline"
    disabled = "disabled"
    error = "error"


class EvidenceType(str, Enum):
    snapshot = "snapshot"
    cropped_object = "cropped_object"
    cropped_person = "cropped_person"
    clip = "clip"


class AlertStatus(str, Enum):
    new = "new"
    sent = "sent"
    read = "read"


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=UserRole.viewer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    totp_secret: Mapped[Optional[str]] = mapped_column(String(64))
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")


# ─── Camera ───────────────────────────────────────────────────────────────────

class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(512), nullable=False)  # 0, /path, rtsp://
    location: Mapped[Optional[str]] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default=CameraStatus.offline)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    fps: Mapped[Optional[float]] = mapped_column(Float)
    last_frame_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    zones: Mapped[List["CameraZone"]] = relationship("CameraZone", back_populates="camera", cascade="all, delete-orphan")
    incidents: Mapped[List["Incident"]] = relationship("Incident", back_populates="camera")


# ─── CameraZone ───────────────────────────────────────────────────────────────

class CameraZone(Base):
    __tablename__ = "camera_zones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    polygon: Mapped[Dict] = mapped_column(JSON, nullable=False)  # {"points": [[x,y], ...]}
    rule_type: Mapped[str] = mapped_column(String(64), nullable=False)  # restricted, loitering, density, etc.
    thresholds: Mapped[Optional[Dict]] = mapped_column(JSON)  # rule-specific overrides
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[Optional[str]] = mapped_column(String(16), default="#2A835F")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    camera: Mapped["Camera"] = relationship("Camera", back_populates="zones")


# ─── Detection ────────────────────────────────────────────────────────────────

class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    class_name: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    bbox: Mapped[Dict] = mapped_column(JSON)  # {x1, y1, x2, y2}
    track_id: Mapped[Optional[int]] = mapped_column(Integer)
    frame_number: Mapped[Optional[int]] = mapped_column(Integer)
    zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("camera_zones.id", ondelete="SET NULL"))


# ─── Event ────────────────────────────────────────────────────────────────────

class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    rule_triggered: Mapped[str] = mapped_column(String(128))
    detected_objects: Mapped[Optional[List]] = mapped_column(JSON)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    track_ids: Mapped[Optional[List]] = mapped_column(JSON)
    zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("camera_zones.id", ondelete="SET NULL"))
    raw_data: Mapped[Optional[Dict]] = mapped_column(JSON)

    incident: Mapped[Optional["Incident"]] = relationship("Incident", back_populates="event", uselist=False)


# ─── Incident ─────────────────────────────────────────────────────────────────

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"))
    camera_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default=IncidentStatus.pending_review, index=True)
    title: Mapped[str] = mapped_column(String(512), default="Potential security incident detected.")
    description: Mapped[Optional[str]] = mapped_column(Text)
    rule_triggered: Mapped[str] = mapped_column(String(128))
    detected_objects: Mapped[Optional[List]] = mapped_column(JSON)
    confidence: Mapped[Optional[float]] = mapped_column(Float)
    track_ids: Mapped[Optional[List]] = mapped_column(JSON)
    zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("camera_zones.id", ondelete="SET NULL"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    acknowledged_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    operator_notes: Mapped[Optional[str]] = mapped_column(Text)
    false_positive_reason: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    camera: Mapped["Camera"] = relationship("Camera", back_populates="incidents")
    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="incident")
    evidence_files: Mapped[List["Evidence"]] = relationship("Evidence", back_populates="incident", cascade="all, delete-orphan")
    alerts: Mapped[List["Alert"]] = relationship("Alert", back_populates="incident")


# ─── Evidence ─────────────────────────────────────────────────────────────────

class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(30), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    mime_type: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped["Incident"] = relationship("Incident", back_populates="evidence_files")


# ─── Alert ────────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default=AlertStatus.new)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    incident: Mapped["Incident"] = relationship("Incident", back_populates="alerts")


# ─── AuditLog ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    user_email: Mapped[Optional[str]] = mapped_column(String(255))  # denormalized for immutability
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64))
    resource_id: Mapped[Optional[str]] = mapped_column(String(128))
    details: Mapped[Optional[Dict]] = mapped_column(JSON)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    user_agent: Mapped[Optional[str]] = mapped_column(String(512))
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


# ─── RuleConfig ───────────────────────────────────────────────────────────────

class RuleConfig(Base):
    __tablename__ = "rule_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(128))
    source: Mapped[str] = mapped_column(String(20), default="coco")
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    consecutive_seconds: Mapped[int] = mapped_column(Integer, default=3)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=60)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
