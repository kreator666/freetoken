"""Video generation pipeline for person-in-VR scenes (stage 2)."""

import argparse
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from image_pipeline import _equirectangular_to_perspective, group_photo


def generate_video(
    person_path: Path,
    scene_path: Path,
    output_path: Path,
    duration_seconds: float = 3.0,
    fps: int = 12,
    motion_description: str = "walk from left to right",
) -> dict:
    """Generate a simple video by animating the person across a yaw sweep."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    total_frames = int(duration_seconds * fps)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (1920, 1080))

    # Simple motion: yaw sweep from -30 to +30 degrees
    start_yaw, end_yaw = -30.0, 30.0
    for i in range(total_frames):
        t = i / max(total_frames - 1, 1)
        yaw = start_yaw + (end_yaw - start_yaw) * t
        frame_path = output_path.parent / f"_frame_{i:04d}.jpg"
        group_photo(
            person_path,
            scene_path,
            frame_path,
            yaw=yaw,
            pitch=0.0,
            distance=3.0,
            shadow=True,
            lighting=True,
        )
        frame = cv2.imread(str(frame_path))
        writer.write(frame)
        frame_path.unlink(missing_ok=True)

    writer.release()

    return {
        "outputPath": str(output_path.absolute()),
        "durationSeconds": duration_seconds,
        "fps": fps,
        "width": 1920,
        "height": 1080,
    }


def main():
    parser = argparse.ArgumentParser(description="Video generation pipeline")
    parser.add_argument("--person", required=True)
    parser.add_argument("--scene", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--duration", type=float, default=3.0)
    parser.add_argument("--fps", type=int, default=12)
    parser.add_argument("--motion", default="walk from left to right")
    args = parser.parse_args()

    try:
        result = generate_video(
            Path(args.person),
            Path(args.scene),
            Path(args.output),
            duration_seconds=args.duration,
            fps=args.fps,
            motion_description=args.motion,
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
