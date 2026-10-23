"""
YOLO detector — loads base model and optional custom model.
GPU auto-detected; falls back to CPU.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class DetectionResult:
    """Single detection from YOLO."""

    def __init__(
        self,
        class_name: str,
        confidence: float,
        bbox: Tuple[int, int, int, int],  # x1, y1, x2, y2
        class_id: int,
    ):
        self.class_name = class_name
        self.confidence = confidence
        self.bbox = bbox  # (x1, y1, x2, y2) in original frame coords
        self.class_id = class_id
        self.track_id: Optional[int] = None

    def to_dict(self) -> Dict:
        return {
            "class_name": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": {"x1": self.bbox[0], "y1": self.bbox[1], "x2": self.bbox[2], "y2": self.bbox[3]},
            "track_id": self.track_id,
        }

    @property
    def center(self) -> Tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) / 2, (y1 + y2) / 2)

    @property
    def area(self) -> float:
        x1, y1, x2, y2 = self.bbox
        return max(0, x2 - x1) * max(0, y2 - y1)


class Detector:
    """
    Wraps YOLO inference.
    - Loads base model (yolov8n.pt) from Ultralytics.
    - Optionally loads custom model from CUSTOM_MODEL_PATH.
    - Runs inference at configured FPS, resized to FRAME_RESIZE_WIDTH.
    - Returns list of DetectionResult objects.
    """

    def __init__(self):
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info("Detector using device: %s", self._device)

        self._base_model: Optional[YOLO] = None
        self._custom_model: Optional[YOLO] = None
        self._custom_model_loaded: bool = False
        self._last_inference_ms: float = 0.0
        self._inference_count: int = 0

        self._load_models()

    def _load_models(self) -> None:
        # Base model
        try:
            logger.info("Loading base YOLO model: %s", settings.yolo_base_model)
            self._base_model = YOLO(settings.yolo_base_model)
            self._base_model.to(self._device)
            logger.info("Base model loaded. Classes: %d", len(self._base_model.names))
        except Exception as exc:
            logger.error("Failed to load base model: %s", exc)
            raise

        # Custom model (optional)
        custom_path = Path(settings.custom_model_path)
        if custom_path.exists():
            try:
                logger.info("Loading custom YOLO model: %s", custom_path)
                self._custom_model = YOLO(str(custom_path))
                self._custom_model.to(self._device)
                self._custom_model_loaded = True
                logger.info("Custom model loaded.")
            except Exception as exc:
                logger.warning("Failed to load custom model: %s", exc)
                self._custom_model_loaded = False
        else:
            logger.info("Custom model not found at %s — running COCO only.", custom_path)
            self._custom_model_loaded = False

    def detect(
        self,
        frame: np.ndarray,
        conf_threshold: float = 0.35,
    ) -> Tuple[List[DetectionResult], np.ndarray]:
        """
        Run inference on a frame.
        Returns (detections, resized_frame_for_display).
        """
        t0 = time.perf_counter()

        # Resize for inference
        h, w = frame.shape[:2]
        target_w = settings.frame_resize_width
        scale = target_w / w
        target_h = int(h * scale)
        small = cv2.resize(frame, (target_w, target_h))

        results: List[DetectionResult] = []

        # Run base model
        if self._base_model:
            results.extend(self._run_model(self._base_model, small, frame, scale, conf_threshold))

        # Run custom model
        if self._custom_model and self._custom_model_loaded:
            results.extend(self._run_model(self._custom_model, small, frame, scale, conf_threshold))

        self._last_inference_ms = (time.perf_counter() - t0) * 1000
        self._inference_count += 1

        return results, small

    def _run_model(
        self,
        model: YOLO,
        small_frame: np.ndarray,
        original_frame: np.ndarray,
        scale: float,
        conf: float,
    ) -> List[DetectionResult]:
        detections = []
        try:
            preds = model.predict(
                small_frame,
                conf=conf,
                verbose=False,
                device=self._device,
            )
            for result in preds:
                if result.boxes is None:
                    continue
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    cls_name = model.names[cls_id]
                    conf_val = float(box.conf[0])
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    # Scale back to original
                    ox1 = int(x1 / scale)
                    oy1 = int(y1 / scale)
                    ox2 = int(x2 / scale)
                    oy2 = int(y2 / scale)
                    detections.append(
                        DetectionResult(
                            class_name=cls_name,
                            confidence=conf_val,
                            bbox=(ox1, oy1, ox2, oy2),
                            class_id=cls_id,
                        )
                    )
        except Exception as exc:
            logger.error("Model inference error: %s", exc)
        return detections

    @property
    def custom_model_loaded(self) -> bool:
        return self._custom_model_loaded

    @property
    def last_inference_ms(self) -> float:
        return round(self._last_inference_ms, 2)

    @property
    def device(self) -> str:
        return self._device

    @property
    def base_model_classes(self) -> Dict[int, str]:
        if self._base_model:
            return dict(self._base_model.names)
        return {}


# Singleton
_detector: Optional[Detector] = None
_det_lock = __import__("threading").Lock()


def get_detector() -> Detector:
    global _detector
    with _det_lock:
        if _detector is None:
            _detector = Detector()
    return _detector
