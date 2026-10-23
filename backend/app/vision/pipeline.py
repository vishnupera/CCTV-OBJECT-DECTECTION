"""
Vision pipeline: combines stream, detector, tracker, event_detector.
Runs inference loop in a background thread.
Draws overlays and provides JPEG frames for the MJPEG stream.
"""
from __future__ import annotations

import logging
import queue
import threading
import time
from typing import Any, Callable, Dict, List, Optional

import cv2
import numpy as np

from app.config import get_settings
from app.vision.stream import StreamManager
from app.vision.detector import Detector, DetectionResult
from app.vision.tracker import Tracker, Track
from app.vision.event_detector import EventDetector, DetectedEvent

logger = logging.getLogger(__name__)
settings = get_settings()

# Severity colors (BGR)
SEVERITY_COLORS = {
    "low": (100, 200, 100),       # green
    "medium": (0, 165, 255),      # orange
    "high": (0, 80, 255),         # red-orange
    "critical": (0, 0, 220),      # red
}

CLASS_COLORS = {
    "person": (42, 131, 95),
    "knife": (0, 80, 255),
    "firearm": (0, 0, 220),
    "fire": (0, 100, 255),
    "backpack": (0, 165, 255),
    "handbag": (0, 165, 255),
    "suitcase": (0, 165, 255),
}

DEFAULT_COLOR = (139, 187, 139)


def get_class_color(class_name: str) -> tuple:
    return CLASS_COLORS.get(class_name, DEFAULT_COLOR)


class VisionPipeline:
    """
    Orchestrates the full vision pipeline for one camera.
    Runs in a background thread at INFERENCE_FPS rate.
    """

    def __init__(
        self,
        camera_id: str,
        stream: StreamManager,
        detector: Detector,
        tracker: Tracker,
        event_detector: EventDetector,
        on_event: Optional[Callable[[DetectedEvent], None]] = None,
    ):
        self.camera_id = camera_id
        self._stream = stream
        self._detector = detector
        self._tracker = tracker
        self._event_detector = event_detector
        self._on_event = on_event

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._show_overlays = True

        # Latest annotated frame as JPEG bytes
        self._jpeg_lock = threading.Lock()
        self._latest_jpeg: Optional[bytes] = None

        # Latest state for WebSocket broadcasts
        self._state_lock = threading.Lock()
        self._latest_state: Dict = {}

        # Event queue for async processing
        self.event_queue: queue.Queue[DetectedEvent] = queue.Queue(maxsize=100)

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name=f"pipeline-{self.camera_id}")
        self._thread.start()
        logger.info("VisionPipeline started for camera: %s", self.camera_id)

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def get_jpeg(self) -> Optional[bytes]:
        with self._jpeg_lock:
            return self._latest_jpeg

    def get_state(self) -> Dict:
        with self._state_lock:
            return dict(self._latest_state)

    def toggle_overlays(self, enabled: bool) -> None:
        self._show_overlays = enabled

    # ── Internal loop ─────────────────────────────────────────────────────────

    def _loop(self) -> None:
        interval = 1.0 / max(1, settings.inference_fps)
        next_tick = time.time()

        while self._running:
            now = time.time()
            if now < next_tick:
                time.sleep(max(0, next_tick - now))
            next_tick += interval

            frame = self._stream.get_frame()
            if frame is None:
                continue

            try:
                detections, small = self._detector.detect(frame)
                tracks = self._tracker.update(detections)
                events = self._event_detector.process(detections, tracks, frame)

                for ev in events:
                    if self._on_event:
                        self._on_event(ev)
                    try:
                        self.event_queue.put_nowait(ev)
                    except queue.Full:
                        pass

                annotated = self._draw_overlays(frame.copy(), detections, tracks) if self._show_overlays else frame
                _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
                with self._jpeg_lock:
                    self._latest_jpeg = buf.tobytes()

                with self._state_lock:
                    self._latest_state = {
                        "camera_id": self.camera_id,
                        "timestamp": now,
                        "detections": [d.to_dict() for d in detections],
                        "tracks": [t.to_dict() for t in tracks],
                        "person_count": sum(1 for d in detections if d.class_name == "person"),
                        "inference_ms": self._detector.last_inference_ms,
                        "stream_fps": self._stream.fps,
                    }

            except Exception as exc:
                logger.error("Pipeline error: %s", exc, exc_info=True)

    # ── Overlay drawing ────────────────────────────────────────────────────────

    def _draw_overlays(
        self,
        frame: np.ndarray,
        detections: List[DetectionResult],
        tracks: List[Track],
    ) -> np.ndarray:
        # Draw zones
        for zone in self._event_detector._last_zones:
            pts = zone.get("polygon", {}).get("points", [])
            if len(pts) >= 3:
                np_pts = np.array(pts, dtype=np.int32)
                color_hex = zone.get("color", "#2A835F")
                color_bgr = _hex_to_bgr(color_hex)
                overlay = frame.copy()
                cv2.fillPoly(overlay, [np_pts], color_bgr)
                cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)
                cv2.polylines(frame, [np_pts], True, color_bgr, 2)
                # Zone label
                if pts:
                    lx, ly = int(pts[0][0]), int(pts[0][1]) - 8
                    cv2.putText(frame, zone.get("name", "Zone"), (lx, ly),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color_bgr, 1, cv2.LINE_AA)

        # Draw bounding boxes + labels
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            color = get_class_color(det.class_name)
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            tid = f"#{det.track_id}" if det.track_id else ""
            label = f"{det.class_name} {det.confidence:.2f} {tid}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)

        # HUD
        h, w = frame.shape[:2]
        fps_text = f"Stream: {self._stream.fps:.1f}fps | Inf: {self._detector.last_inference_ms:.0f}ms"
        cv2.putText(frame, fps_text, (10, h - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (139, 187, 139), 1, cv2.LINE_AA)

        # Model status
        if not self._detector.custom_model_loaded:
            cv2.putText(frame, "Custom model not loaded", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 1, cv2.LINE_AA)

        return frame


def _hex_to_bgr(hex_color: str) -> tuple:
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (b, g, r)


# ── Pipeline registry ─────────────────────────────────────────────────────────

_pipelines: Dict[str, VisionPipeline] = {}
_plock = threading.Lock()


def get_pipeline(camera_id: str) -> Optional[VisionPipeline]:
    with _plock:
        return _pipelines.get(camera_id)


def register_pipeline(camera_id: str, pipeline: VisionPipeline) -> None:
    with _plock:
        _pipelines[camera_id] = pipeline


def stop_pipeline(camera_id: str) -> None:
    with _plock:
        pipeline = _pipelines.pop(camera_id, None)
        if pipeline:
            pipeline.stop()
    from app.vision.stream import stop_stream_manager
    stop_stream_manager(camera_id)


def all_pipelines() -> Dict[str, VisionPipeline]:
    with _plock:
        return dict(_pipelines)
