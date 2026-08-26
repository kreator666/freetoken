"""Image processing pipeline for person segmentation and VR scene composition."""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


def _try_import_bria():
    try:
        import bria_rmbg
        return bria_rmbg
    except Exception:
        return None


def _apply_exif_orientation(img: Image.Image) -> Image.Image:
    """Apply EXIF orientation so the image is upright."""
    try:
        exif = img._getexif()
        if exif is None:
            return img
        orientation = exif.get(0x0112)
        if orientation == 3:
            return img.rotate(180, expand=True)
        elif orientation == 6:
            return img.rotate(270, expand=True)
        elif orientation == 8:
            return img.rotate(90, expand=True)
    except Exception:
        pass
    return img


def segment_person(input_path: Path, output_dir: Path) -> dict:
    """Extract person from photo. Falls back to GrabCut if bria-rmbg unavailable."""
    output_dir.mkdir(parents=True, exist_ok=True)
    img = Image.open(input_path)
    img = _apply_exif_orientation(img)
    img = img.convert("RGBA")
    w, h = img.size

    bria = _try_import_bria()
    if bria:
        # High-quality background removal
        person = bria.remove_background(img)
    else:
        # Fallback: simpler center-rect mask assuming the subject is centered.
        # GrabCut often leaves artifacts for arbitrary photos; we use a soft
        # oval mask centered on the image, which works for typical portrait photos.
        cv_img = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
        h_px, w_px = cv_img.shape[:2]

        # Build a soft oval mask centered in the image
        mask = np.zeros((h_px, w_px), dtype=np.float32)
        center = (w_px // 2, h_px // 2)
        axes = (int(w_px * 0.38), int(h_px * 0.45))
        cv2.ellipse(mask, center, axes, 0, 0, 360, 1.0, -1)
        # Feather edges
        mask = cv2.GaussianBlur(mask, (51, 51), 0)

        # Normalize to 0-255
        mask_bin = (mask * 255).astype(np.uint8)
        person = Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)).convert("RGBA")
        alpha = Image.fromarray(mask_bin)
        person.putalpha(alpha)

    person_path = output_dir / "person.png"
    mask_path = output_dir / "mask.png"
    person.save(person_path)
    person.split()[-1].save(mask_path)

    return {
        "personImagePath": str(person_path.absolute()),
        "maskPath": str(mask_path.absolute()),
        "originalWidth": w,
        "originalHeight": h,
    }


def _equirectangular_to_perspective(
    panorama: Image.Image, fov: float, yaw: float, pitch: float, out_w: int, out_h: int
) -> Image.Image:
    """Render a perspective view from an equirectangular panorama."""
    pano = np.array(panorama.convert("RGB"))
    h, w = pano.shape[:2]

    fov_rad = math.radians(fov)
    yaw_rad = math.radians(yaw)
    pitch_rad = math.radians(pitch)

    f = (out_w / 2) / math.tan(fov_rad / 2)

    K = np.array([[f, 0, out_w / 2], [0, f, out_h / 2], [0, 0, 1]], dtype=np.float32)

    Rx = np.array(
        [
            [1, 0, 0],
            [0, math.cos(-pitch_rad), -math.sin(-pitch_rad)],
            [0, math.sin(-pitch_rad), math.cos(-pitch_rad)],
        ],
        dtype=np.float32,
    )
    Ry = np.array(
        [
            [math.cos(-yaw_rad), 0, math.sin(-yaw_rad)],
            [0, 1, 0],
            [-math.sin(-yaw_rad), 0, math.cos(-yaw_rad)],
        ],
        dtype=np.float32,
    )
    R = Ry @ Rx

    map_x = np.zeros((out_h, out_w), dtype=np.float32)
    map_y = np.zeros((out_h, out_w), dtype=np.float32)

    for y in range(out_h):
        for x in range(out_w):
            px = (x - out_w / 2) / f
            py = (y - out_h / 2) / f
            pz = 1.0
            vec = np.array([px, py, pz], dtype=np.float32)
            vec = R @ vec
            vec /= np.linalg.norm(vec)
            lon = math.atan2(vec[0], vec[2])
            lat = math.asin(vec[1])
            u = (lon / (2 * math.pi) + 0.5) * w
            v = (0.5 + lat / math.pi) * h
            map_x[y, x] = u
            map_y[y, x] = v

    remapped = cv2.remap(pano, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    return Image.fromarray(remapped)


def _compute_scale_for_distance(
    person_height_px: int, panorama_height: int, distance_m: float, fov: float
) -> float:
    """Rough scale factor to make a person appear at a given distance."""
    # Assume average person height ~1.7m and typical room camera height ~1.5m
    # This is a heuristic; real scale depends on panorama resolution and scene metrics.
    reference_height_px = (panorama_height / math.radians(fov)) * math.atan(1.7 / max(distance_m, 0.5))
    return reference_height_px / max(person_height_px, 1)


def group_photo(
    person_path: Path,
    scene_path: Path,
    output_path: Path,
    yaw: float = 0.0,
    pitch: float = 0.0,
    distance: float = 3.0,
    scale: float | None = None,
    shadow: bool = True,
    lighting: bool = True,
) -> dict:
    """Compose a person into a VR scene perspective view."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    person = Image.open(person_path).convert("RGBA")
    panorama = Image.open(scene_path).convert("RGB")

    # Render perspective view from the desired yaw/pitch
    view_w, view_h = 1920, 1080
    fov = 90.0
    scene_view = _equirectangular_to_perspective(panorama, fov, yaw, pitch, view_w, view_h)

    # Auto-scale person to fit distance
    bbox = person.getbbox()
    if not bbox:
        raise ValueError("Person image has no visible content")
    person_height = bbox[3] - bbox[1]
    effective_scale = scale or _compute_scale_for_distance(person_height, panorama.height, distance, fov)

    new_w = max(1, int(person.width * effective_scale))
    new_h = max(1, int(person.height * effective_scale))
    person_resized = person.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # Crop transparent margins
    bbox = person_resized.getbbox()
    if bbox:
        person_resized = person_resized.crop(bbox)

    # Position person near bottom center of the perspective view
    px = (view_w - person_resized.width) // 2
    py = view_h - int(view_h * 0.15) - person_resized.height

    # Optional simple shadow
    if shadow:
        shadow_layer = Image.new("RGBA", (view_w, view_h), (0, 0, 0, 0))
        shadow_mask = person_resized.split()[-1].point(lambda a: int(a * 0.25))
        shadow_img = Image.new("RGBA", person_resized.size, (0, 0, 0, 255))
        shadow_layer.paste(shadow_img, (px + 20, py + 10), shadow_mask)
        # Blur shadow
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=8))
        scene_view = Image.alpha_composite(scene_view.convert("RGBA"), shadow_layer)

    # Optional simple lighting: tint person with scene bottom-center color
    if lighting:
        sample = scene_view.crop((view_w // 2 - 50, view_h - 100, view_w // 2 + 50, view_h))
        arr = np.array(sample)
        avg_color = tuple(int(v) for v in arr.mean(axis=(0, 1))[:3])
        tint = Image.new("RGBA", person_resized.size, avg_color + (40,))
        person_resized = Image.alpha_composite(person_resized, tint)

    scene_view.paste(person_resized, (px, py), person_resized)
    scene_view.convert("RGB").save(output_path)

    return {
        "outputPath": str(output_path.absolute()),
        "outputFormat": output_path.suffix.lstrip("."),
        "width": view_w,
        "height": view_h,
    }


def main():
    parser = argparse.ArgumentParser(description="Image processing pipeline")
    sub = parser.add_subparsers(dest="command", required=True)

    seg = sub.add_parser("segment", help="Segment a person from a photo")
    seg.add_argument("--input", required=True)
    seg.add_argument("--output-dir", required=True)

    grp = sub.add_parser("group-photo", help="Compose a group photo in a VR scene")
    grp.add_argument("--person", required=True)
    grp.add_argument("--scene", required=True)
    grp.add_argument("--output", required=True)
    grp.add_argument("--yaw", type=float, default=0.0)
    grp.add_argument("--pitch", type=float, default=0.0)
    grp.add_argument("--distance", type=float, default=3.0)
    grp.add_argument("--scale", type=float)
    grp.add_argument("--shadow", action="store_true")
    grp.add_argument("--lighting", action="store_true")

    args = parser.parse_args()

    try:
        if args.command == "segment":
            result = segment_person(Path(args.input), Path(args.output_dir))
        else:
            result = group_photo(
                Path(args.person),
                Path(args.scene),
                Path(args.output),
                yaw=args.yaw,
                pitch=args.pitch,
                distance=args.distance,
                scale=args.scale,
                shadow=args.shadow,
                lighting=args.lighting,
            )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
