"""
Video stream manager — background thread, auto-reconnect, rolling frame buffer.
Reads VIDEO_SOURCE from .env: 0=webcam, path=MP4, rtsp://=network stream.
"""
from __future__ import annotations

import logging
import threading
import time
from collections import deque
from typing import Deque, Optional, Tuple

import cv2
import numpy as np

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class FrameBuffer:
    """Thread-safe rolling buffer of (timestamp, frame) tuples."""

    def __init__(self, max_seconds: int = 15, fps: int = 5):
        self._maxlen = max_seconds * fps
        self._buf: Deque[Tuple[float, np.ndarray]] = deque(maxlen=self._maxlen)
        self._lock = threading.Lock()

    def push(self, frame: np.ndarray) -> None:
        with self._lock:
            self._buf.append((time.time(), frame.copy()))

    def get_window(self, before_sec: float, after_sec: float, ref_ts: Optional[float] = None) -> list:
        """Return frames within [ref_ts - before_sec, ref_ts + after_sec]."""
        if ref_ts is None:
            ref_ts = time.time()
        lo = ref_ts - before_sec
        hi = ref_ts + after_sec
        with self._lock:
            return [(ts, f) for ts, f in self._buf if lo <= ts <= hi]

    def latest(self) -> Optional[Tuple[float, np.ndarray]]:
        with self._lock:
            return self._buf[-1] if self._buf else None


class StreamManager:
    """
    Background thread that continuously reads frames from the video source.
    Auto-reconnects on stream drop.
    """

    def __init__(self, source: Optional[str] = None):
        raw = source or settings.video_source
        # Convert "0" string to int for webcam
        self._source: int | str = int(raw) if raw.isdigit() else raw
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame_buffer = FrameBuffer(
            max_seconds=settings.frame_buffer_seconds,
            fps=settings.inference_fps,
        )
        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._fps: float = 0.0
        self._frame_count: int = 0
        self._last_frame_time: float = 0.0
        self._error: Optional[str] = None

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        logger.info("StreamManager started for source: %s", self._source)

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        if self._cap:
            self._cap.release()
            self._cap = None
        with self._frame_lock:
            self._latest_frame = None
        logger.info("StreamManager stopped")

    def get_frame(self) -> Optional[np.ndarray]:
        with self._frame_lock:
            return self._latest_frame.copy() if self._latest_frame is not None else None

    @property
    def frame_buffer(self) -> FrameBuffer:
        return self._frame_buffer

    @property
    def fps(self) -> float:
        return round(self._fps, 2)

    @property
    def last_frame_time(self) -> float:
        return self._last_frame_time

    @property
    def is_connected(self) -> bool:
        return self._cap is not None and self._cap.isOpened() and self._latest_frame is not None

    @property
    def error(self) -> Optional[str]:
        return self._error

    # ── Internal ──────────────────────────────────────────────────────────────

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        try:
            cap = cv2.VideoCapture(self._source)
            if not cap.isOpened():
                self._error = f"Cannot open source: {self._source}"
                logger.warning(self._error)
                return None
            self._error = None
            logger.info("Video capture opened: %s", self._source)
            return cap
        except Exception as exc:
            self._error = str(exc)
            logger.error("Failed to open capture: %s", exc)
            return None

    def _capture_loop(self) -> None:
        fps_counter = 0
        fps_timer = time.time()

        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self._cap = self._open_capture()
                if self._cap is None:
                    time.sleep(3)  # retry delay
                    continue

            ret, frame = self._cap.read()
            if not ret:
                if isinstance(self._source, str) and not self._source.startswith("rtsp://"):
                    # Rewind video file to beginning for continuous loop
                    self._cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self._cap.read()
                if not ret:
                    logger.warning("Frame read failed, reconnecting...")
                    self._cap.release()
                    self._cap = None
                    time.sleep(1)
                    continue

            self._last_frame_time = time.time()
            self._frame_count += 1
            fps_counter += 1

            # FPS calculation every second
            elapsed = time.time() - fps_timer
            if elapsed >= 1.0:
                self._fps = fps_counter / elapsed
                fps_counter = 0
                fps_timer = time.time()

            with self._frame_lock:
                self._latest_frame = frame.copy()

            self._frame_buffer.push(frame)

            # Throttle to avoid CPU burn when reading from files
            if isinstance(self._source, str) and self._source.endswith((".mp4", ".avi", ".mov")):
                time.sleep(max(0, 1.0 / 30 - 0.001))  # cap at ~30fps for files


# ─── Singleton instances (one per camera in production, one for dev) ──────────

_stream_managers: dict[str, StreamManager] = {}
_lock = threading.Lock()


def get_stream_manager(camera_id: str = "default") -> StreamManager:
    with _lock:
        if camera_id not in _stream_managers:
            _stream_managers[camera_id] = StreamManager()
        return _stream_managers[camera_id]


def create_stream_manager(camera_id: str, source: str) -> StreamManager:
    with _lock:
        if camera_id in _stream_managers:
            _stream_managers[camera_id].stop()
        mgr = StreamManager(source=source)
        _stream_managers[camera_id] = mgr
        mgr.start()
        return mgr


def stop_stream_manager(camera_id: str) -> None:
    with _lock:
        mgr = _stream_managers.pop(camera_id, None)
        if mgr:
            mgr.stop()
