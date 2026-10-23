"""
Event detector — applies behavior rules against tracked detections.
Produces Event objects when thresholds are crossed.
Uses cooldown + consecutive-seconds deduplication.
All logic is deterministic code/config — no LLM.
"""
from __future__ import annotations

import time
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
from pathlib import Path

import numpy as np
import yaml

from app.config import get_settings
from app.vision.tracker import Track
from app.vision.detector import DetectionResult

logger = logging.getLogger(__name__)
settings = get_settings()


# ─── Watchlist config loader ──────────────────────────────────────────────────

def _load_watchlist() -> Dict:
    candidates = [
        Path(settings.watchlist_config_path),
        Path("watchlist.yaml"),
        Path("backend/watchlist.yaml"),
        Path(__file__).parent.parent.parent / "watchlist.yaml",
    ]
    path = next((p for p in candidates if p.exists()), None)
    if not path:
        logger.warning("Watchlist config not found in candidates: %s", candidates)
        return {"classes": [], "rules": {}}
    with open(path, "r") as f:
        return yaml.safe_load(f)


_watchlist_cache: Optional[Dict] = None
_watchlist_loaded_at: float = 0.0


def get_watchlist() -> Dict:
    global _watchlist_cache, _watchlist_loaded_at
    # Reload every 60s to support live edits
    if _watchlist_cache is None or time.time() - _watchlist_loaded_at > 60:
        _watchlist_cache = _load_watchlist()
        _watchlist_loaded_at = time.time()
    return _watchlist_cache


def get_class_config(class_name: str) -> Optional[Dict]:
    wl = get_watchlist()
    for entry in wl.get("classes", []):
        if entry["class"] == class_name and entry.get("enabled", True):
            return entry
    return None


# ─── Detected Event dataclass ─────────────────────────────────────────────────

@dataclass
class DetectedEvent:
    event_type: str
    severity: str                     # low/medium/high/critical
    rule_triggered: str
    camera_id: str
    timestamp: float = field(default_factory=time.time)
    detected_objects: List[Dict] = field(default_factory=list)
    confidence: Optional[float] = None
    track_ids: List[int] = field(default_factory=list)
    zone_id: Optional[str] = None
    raw_data: Dict = field(default_factory=dict)
    title: str = "Potential security incident detected."

    def to_dict(self) -> Dict:
        return {
            "event_type": self.event_type,
            "severity": self.severity,
            "rule_triggered": self.rule_triggered,
            "camera_id": self.camera_id,
            "timestamp": self.timestamp,
            "detected_objects": self.detected_objects,
            "confidence": self.confidence,
            "track_ids": self.track_ids,
            "zone_id": self.zone_id,
            "raw_data": self.raw_data,
            "title": self.title,
        }


# ─── Cooldown tracker ─────────────────────────────────────────────────────────

class CooldownTracker:
    """Track cooldowns per (camera_id, event_type) key."""

    def __init__(self):
        self._last_fired: Dict[str, float] = {}

    def can_fire(self, key: str, cooldown_seconds: float) -> bool:
        last = self._last_fired.get(key, 0)
        return time.time() - last >= cooldown_seconds

    def mark_fired(self, key: str) -> None:
        self._last_fired[key] = time.time()


# ─── Consecutive-seconds tracker ──────────────────────────────────────────────

class ConsecutiveTracker:
    """Track how long a condition has been continuously true."""

    def __init__(self):
        self._started: Dict[str, float] = {}

    def update(self, key: str, active: bool) -> float:
        """Returns seconds active, or 0 if not active."""
        if active:
            if key not in self._started:
                self._started[key] = time.time()
            return time.time() - self._started[key]
        else:
            self._started.pop(key, None)
            return 0.0


# ─── Polygon helpers ──────────────────────────────────────────────────────────

def point_in_polygon(px: float, py: float, polygon: List[Tuple]) -> bool:
    """Ray-casting algorithm for point-in-polygon."""
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def polygon_from_zone(zone: Dict) -> List[Tuple]:
    return [(p[0], p[1]) for p in zone.get("polygon", {}).get("points", [])]


# ─── Main Event Detector ──────────────────────────────────────────────────────

class EventDetector:
    """
    Applies behavior rules against current detections and tracks.
    Emits DetectedEvent objects via event_callback.
    """

    def __init__(self, camera_id: str, event_callback=None):
        self.camera_id = camera_id
        self.event_callback = event_callback
        self._cooldown = CooldownTracker()
        self._consecutive = ConsecutiveTracker()
        # Track first-seen times for bag static detection
        self._bag_static_start: Dict[int, float] = {}
        self._last_zones: List[Dict] = []

    def set_zones(self, zones: List[Dict]) -> None:
        self._last_zones = zones

    def process(
        self,
        detections: List[DetectionResult],
        tracks: List[Track],
        frame: np.ndarray,
    ) -> List[DetectedEvent]:
        events: List[DetectedEvent] = []

        # 1. Watch-list class alerts
        events.extend(self._check_watchlist(detections))

        # 2. Crowd density spike per zone
        events.extend(self._check_crowd_density(tracks))

        # 3. Stampede / sudden movement
        events.extend(self._check_stampede(tracks))

        # 4. Unattended bag
        events.extend(self._check_unattended_bags(detections, tracks))

        # 5. Zone rules (loitering, restricted)
        events.extend(self._check_zone_rules(tracks))

        for ev in events:
            if self.event_callback:
                self.event_callback(ev)

        return events

    # ── Watch-list rule ───────────────────────────────────────────────────────

    def _check_watchlist(self, detections: List[DetectionResult]) -> List[DetectedEvent]:
        events = []
        for det in detections:
            cfg = get_class_config(det.class_name)
            if not cfg:
                continue
            if det.confidence < cfg.get("confidence", 0.5):
                continue

            consecutive_key = f"{self.camera_id}:watchlist:{det.class_name}:{det.track_id}"
            duration = self._consecutive.update(consecutive_key, True)
            required = cfg.get("consecutive_seconds", 1)

            if duration >= required:
                cooldown_key = f"{self.camera_id}:watchlist:{det.class_name}"
                cooldown = cfg.get("cooldown_seconds", 60)
                if self._cooldown.can_fire(cooldown_key, cooldown):
                    self._cooldown.mark_fired(cooldown_key)
                    events.append(DetectedEvent(
                        event_type=f"watchlist:{det.class_name}",
                        severity=cfg.get("tier", "medium"),
                        rule_triggered="watchlist_detection",
                        camera_id=self.camera_id,
                        detected_objects=[det.to_dict()],
                        confidence=det.confidence,
                        track_ids=[det.track_id] if det.track_id else [],
                    ))
        return events

    # ── Crowd density ─────────────────────────────────────────────────────────

    def _check_crowd_density(self, tracks: List[Track]) -> List[DetectedEvent]:
        wl = get_watchlist()
        rule = wl.get("rules", {}).get("crowd_density", {})
        if not rule.get("enabled", True):
            return []

        person_tracks = [t for t in tracks if t.class_name == "person"]
        threshold = rule.get("person_threshold", 20)
        cooldown = rule.get("cooldown_seconds", 120)
        tier = rule.get("tier", "medium")

        for zone in self._last_zones:
            if zone.get("rule_type") != "density":
                continue
            polygon = polygon_from_zone(zone)
            if not polygon:
                continue
            zone_id = zone.get("id")
            count = sum(1 for t in person_tracks if point_in_polygon(t.center[0], t.center[1], polygon))
            key = f"{self.camera_id}:density:{zone_id}"
            duration = self._consecutive.update(key, count >= threshold)
            if duration >= 2.0:
                cooldown_key = f"{self.camera_id}:crowd_density:{zone_id}"
                if self._cooldown.can_fire(cooldown_key, cooldown):
                    self._cooldown.mark_fired(cooldown_key)
                    return [DetectedEvent(
                        event_type="crowd_density_spike",
                        severity=tier,
                        rule_triggered="crowd_density",
                        camera_id=self.camera_id,
                        detected_objects=[],
                        raw_data={"person_count": count, "threshold": threshold},
                        zone_id=zone_id,
                        track_ids=[t.track_id for t in person_tracks],
                    )]

        # Global density (no zones)
        if not self._last_zones:
            count = len(person_tracks)
            key = f"{self.camera_id}:density:global"
            duration = self._consecutive.update(key, count >= threshold)
            if duration >= 2.0:
                cooldown_key = f"{self.camera_id}:crowd_density:global"
                if self._cooldown.can_fire(cooldown_key, cooldown):
                    self._cooldown.mark_fired(cooldown_key)
                    return [DetectedEvent(
                        event_type="crowd_density_spike",
                        severity=tier,
                        rule_triggered="crowd_density",
                        camera_id=self.camera_id,
                        raw_data={"person_count": count, "threshold": threshold},
                        track_ids=[t.track_id for t in person_tracks],
                    )]
        return []

    # ── Stampede detection ────────────────────────────────────────────────────

    def _check_stampede(self, tracks: List[Track]) -> List[DetectedEvent]:
        wl = get_watchlist()
        rule = wl.get("rules", {}).get("stampede_detection", {})
        if not rule.get("enabled", True):
            return []

        velocity_threshold = rule.get("velocity_threshold", 80)
        min_tracks = rule.get("min_tracks", 10)
        cooldown = rule.get("cooldown_seconds", 60)
        tier = rule.get("tier", "high")

        person_tracks = [t for t in tracks if t.class_name == "person"]
        fast_tracks = [t for t in person_tracks if t.velocity >= velocity_threshold]

        key = f"{self.camera_id}:stampede"
        duration = self._consecutive.update(key, len(fast_tracks) >= min_tracks)
        if duration >= 1.0:
            cooldown_key = f"{self.camera_id}:stampede"
            if self._cooldown.can_fire(cooldown_key, cooldown):
                self._cooldown.mark_fired(cooldown_key)
                return [DetectedEvent(
                    event_type="sudden_crowd_movement",
                    severity=tier,
                    rule_triggered="stampede_detection",
                    camera_id=self.camera_id,
                    track_ids=[t.track_id for t in fast_tracks],
                    raw_data={"fast_track_count": len(fast_tracks), "velocity_threshold": velocity_threshold},
                )]
        return []

    # ── Unattended bag ────────────────────────────────────────────────────────

    def _check_unattended_bags(
        self,
        detections: List[DetectionResult],
        tracks: List[Track],
    ) -> List[DetectedEvent]:
        wl = get_watchlist()
        rule = wl.get("rules", {}).get("unattended_bag", {})
        if not rule.get("enabled", True):
            return []

        bag_classes = {"backpack", "handbag", "suitcase"}
        radius = rule.get("no_person_radius_px", 150)
        static_secs = rule.get("static_seconds", 30)
        cooldown = rule.get("cooldown_seconds", 120)
        tier = rule.get("tier", "high")

        person_tracks = [t for t in tracks if t.class_name == "person"]
        events = []

        for bag in [t for t in tracks if t.class_name in bag_classes]:
            if not bag.is_static():
                self._bag_static_start.pop(bag.track_id, None)
                continue

            # Check person nearby
            bx, by = bag.center
            nearby = any(
                ((bx - t.center[0]) ** 2 + (by - t.center[1]) ** 2) ** 0.5 < radius
                for t in person_tracks
            )
            if nearby:
                self._bag_static_start.pop(bag.track_id, None)
                continue

            if bag.track_id not in self._bag_static_start:
                self._bag_static_start[bag.track_id] = time.time()

            elapsed = time.time() - self._bag_static_start[bag.track_id]
            if elapsed >= static_secs:
                cooldown_key = f"{self.camera_id}:unattended_bag:{bag.track_id}"
                if self._cooldown.can_fire(cooldown_key, cooldown):
                    self._cooldown.mark_fired(cooldown_key)
                    events.append(DetectedEvent(
                        event_type="unattended_bag",
                        severity=tier,
                        rule_triggered="unattended_bag",
                        camera_id=self.camera_id,
                        track_ids=[bag.track_id],
                        detected_objects=[bag.to_dict()],
                        raw_data={"static_seconds": round(elapsed, 1), "class": bag.class_name},
                    ))
        return events

    # ── Zone rules ────────────────────────────────────────────────────────────

    def _check_zone_rules(self, tracks: List[Track]) -> List[DetectedEvent]:
        events = []
        wl = get_watchlist()

        for zone in self._last_zones:
            rule_type = zone.get("rule_type", "")
            polygon = polygon_from_zone(zone)
            if not polygon:
                continue
            zone_id = zone.get("id", "unknown")
            thresholds = zone.get("thresholds") or {}

            if rule_type == "restricted":
                rule = wl.get("rules", {}).get("restricted_zone", {})
                if not rule.get("enabled", True):
                    continue
                intrusion_secs = thresholds.get("intrusion_seconds", rule.get("intrusion_seconds", 3))
                cooldown = rule.get("cooldown_seconds", 60)
                tier = rule.get("tier", "high")

                for track in [t for t in tracks if t.class_name == "person"]:
                    inside = point_in_polygon(track.center[0], track.center[1], polygon)
                    key = f"{self.camera_id}:restricted:{zone_id}:{track.track_id}"
                    duration = self._consecutive.update(key, inside)
                    if duration >= intrusion_secs:
                        cooldown_key = f"{self.camera_id}:restricted:{zone_id}:{track.track_id}"
                        if self._cooldown.can_fire(cooldown_key, cooldown):
                            self._cooldown.mark_fired(cooldown_key)
                            events.append(DetectedEvent(
                                event_type="restricted_zone_intrusion",
                                severity=tier,
                                rule_triggered="restricted_zone",
                                camera_id=self.camera_id,
                                track_ids=[track.track_id],
                                zone_id=zone_id,
                                raw_data={"duration_seconds": round(duration, 1)},
                            ))

            elif rule_type == "loitering":
                rule = wl.get("rules", {}).get("loitering", {})
                if not rule.get("enabled", True):
                    continue
                loiter_secs = thresholds.get("duration_seconds", rule.get("duration_seconds", 120))
                cooldown = rule.get("cooldown_seconds", 300)
                tier = rule.get("tier", "low")

                for track in [t for t in tracks if t.class_name == "person"]:
                    inside = point_in_polygon(track.center[0], track.center[1], polygon)
                    key = f"{self.camera_id}:loitering:{zone_id}:{track.track_id}"
                    duration = self._consecutive.update(key, inside)
                    if duration >= loiter_secs:
                        cooldown_key = f"{self.camera_id}:loitering:{zone_id}:{track.track_id}"
                        if self._cooldown.can_fire(cooldown_key, cooldown):
                            self._cooldown.mark_fired(cooldown_key)
                            events.append(DetectedEvent(
                                event_type="loitering",
                                severity=tier,
                                rule_triggered="loitering",
                                camera_id=self.camera_id,
                                track_ids=[track.track_id],
                                zone_id=zone_id,
                                raw_data={"duration_seconds": round(duration, 1)},
                            ))

        return events


# ── Per-camera event detector singletons ──────────────────────────────────────

_event_detectors: Dict[str, EventDetector] = {}
_elock = __import__("threading").Lock()


def get_event_detector(camera_id: str, event_callback=None) -> EventDetector:
    with _elock:
        if camera_id not in _event_detectors:
            _event_detectors[camera_id] = EventDetector(camera_id, event_callback)
        return _event_detectors[camera_id]
