#!/usr/bin/env python3
"""
Sample MP4 replay script.
Downloads a short public-domain crowd video and sets VIDEO_SOURCE to it
so the full pipeline can be tested without a webcam.

Usage:
    python scripts/replay_sample.py

This temporarily sets VIDEO_SOURCE=data/videos/sample.mp4 and starts the backend.
"""
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

SAMPLE_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
SAMPLE_PATH = Path("data/videos/sample.mp4")
BACKEND_DIR = Path("backend")

def download_sample():
    SAMPLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SAMPLE_PATH.exists():
        print(f"Sample video already exists: {SAMPLE_PATH}")
        return
    print(f"Downloading sample video to {SAMPLE_PATH}...")
    urllib.request.urlretrieve(SAMPLE_URL, SAMPLE_PATH)
    print("Download complete.")

def main():
    download_sample()
    print(f"\nStarting backend with VIDEO_SOURCE={SAMPLE_PATH}")
    print("Press Ctrl+C to stop.\n")
    
    env = os.environ.copy()
    env["VIDEO_SOURCE"] = str(SAMPLE_PATH)
    
    venv_python = str(BACKEND_DIR / "venv" / "Scripts" / "python.exe")
    if not Path(venv_python).exists():
        venv_python = sys.executable
    
    subprocess.run(
        [venv_python, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5000", "--reload"],
        cwd=BACKEND_DIR,
        env=env,
    )

if __name__ == "__main__":
    main()
