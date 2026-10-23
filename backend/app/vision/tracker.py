"""
Simple IoU-based SORT tracker (no external C extensions needed).
Assigns persistent track IDs across frames.
For production, swap with ByteTrack via ultralytics tracking API.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from app.vision.detector import DetectionResult


@dataclass
class Track:
    track_id: int
    class_name: str
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    age: int = 0          # frames alive
    hits: int = 1         # confirmed detections
    misses: int = 0       # consecutive frames without match
    positions: List[Tuple[float, float]] = field(default_factory=list)  # (cx, cy) history

    def update(self, det: DetectionResult) -> None:
        self.bbox = det.bbox
        self.confidence = det.confidence
        self.last_seen = time.time()
        self.hits += 1
        self.misses = 0
        cx, cy = det.center
        self.positions.append((cx, cy))
        if len(self.positions) > 50:
            self.positions.pop(0)

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    @property
    def duration_seconds(self) -> float:
        return time.time() - self.first_seen

    @property
    def velocity(self) -> float:
        """Average pixel-per-second speed over last 10 positions."""
        if len(self.positions) < 2:
            return 0.0
        pts = self.positions[-10:]
        total = 0.0
        for i in range(1, len(pts)):
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
            total += (dx ** 2 + dy ** 2) ** 0.5
        return total / max(1, len(pts) - 1)

    def is_static(self, px_threshold: float = 10.0) -> bool:
        return self.velocity < px_threshold

    def to_dict(self) -> dict:
        return {
            "track_id": self.track_id,
            "class_name": self.class_name,
            "bbox": {"x1": self.bbox[0], "y1": self.bbox[1], "x2": self.bbox[2], "y2": self.bbox[3]},
            "confidence": round(self.confidence, 3),
            "duration_seconds": round(self.duration_seconds, 1),
            "velocity": round(self.velocity, 1),
            "center": {"x": round(self.center[0], 1), "y": round(self.center[1], 1)},
        }


def iou(box1: Tuple, box2: Tuple) -> float:
    """Compute Intersection over Union for two (x1,y1,x2,y2) boxes."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    if inter == 0:
        return 0.0
    a1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    a2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    return inter / (a1 + a2 - inter + 1e-6)


class Tracker:
    """
    IoU-based SORT tracker.
    Maintains track IDs across frames, records position history for velocity.
    """

    def __init__(
        self,
        iou_threshold: float = 0.3,
        max_misses: int = 10,
    ):
        self._tracks: Dict[int, Track] = {}
        self._next_id = 1
        self._iou_threshold = iou_threshold
        self._max_misses = max_misses

    def update(self, detections: List[DetectionResult]) -> List[Track]:
        """
        Match detections to existing tracks by IoU.
        Returns list of active Track objects (with track_id set on each DetectionResult).
        """
        active_track_ids = set(self._tracks.keys())

        # Greedy matching: for each track, find best-matching detection
        matched_det_indices = set()
        for track_id, track in list(self._tracks.items()):
            best_iou = 0.0
            best_idx = -1
            for i, det in enumerate(detections):
                if i in matched_det_indices:
                    continue
                if det.class_name != track.class_name:
                    continue
                score = iou(track.bbox, det.bbox)
                if score > best_iou:
                    best_iou = score
                    best_idx = i

            if best_iou >= self._iou_threshold and best_idx >= 0:
                track.update(detections[best_idx])
                detections[best_idx].track_id = track_id
                matched_det_indices.add(best_idx)
            else:
                track.misses += 1

        # Create new tracks for unmatched detections
        for i, det in enumerate(detections):
            if i not in matched_det_indices:
                new_track = Track(
                    track_id=self._next_id,
                    class_name=det.class_name,
                    bbox=det.bbox,
                    confidence=det.confidence,
                )
                new_track.positions.append(det.center)
                self._tracks[self._next_id] = new_track
                det.track_id = self._next_id
                self._next_id += 1

        # Prune dead tracks
        for track_id in list(self._tracks.keys()):
            if self._tracks[track_id].misses > self._max_misses:
                del self._tracks[track_id]

        return list(self._tracks.values())

    def get_track(self, track_id: int) -> Optional[Track]:
        return self._tracks.get(track_id)

    @property
    def active_tracks(self) -> List[Track]:
        return list(self._tracks.values())

    def get_tracks_by_class(self, class_name: str) -> List[Track]:
        return [t for t in self._tracks.values() if t.class_name == class_name]


# ── Per-camera tracker singletons ─────────────────────────────────────────────

_trackers: Dict[str, Tracker] = {}
_tlock = __import__("threading").Lock()


def get_tracker(camera_id: str = "default") -> Tracker:
    with _tlock:
        if camera_id not in _trackers:
            _trackers[camera_id] = Tracker()
        return _trackers[camera_id]
