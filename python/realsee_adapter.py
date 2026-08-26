"""Adapter for fetching Realsee VR scenes and panoramas."""

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

load_dotenv()

DEFAULT_OUTPUT_DIR = Path("assets/temp")


def fetch_panorama(scene_id: str, output_path: Path) -> dict:
    """Fetch a panorama by scene id, local path, or URL."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if scene_id.startswith("local:"):
        local = Path(scene_id.replace("local:", ""))
        if not local.exists():
            raise FileNotFoundError(f"Local panorama not found: {local}")
        return {"path": str(local.absolute()), "source": "local"}

    parsed = urlparse(scene_id)
    if parsed.scheme in ("http", "https"):
        r = requests.get(scene_id, timeout=60)
        r.raise_for_status()
        output_path.write_bytes(r.content)
        return {"path": str(output_path.absolute()), "source": "url"}

    # Real Realsee API path
    base_url = os.getenv("REALSEE_BASE_URL", "https://open-platform.realsee.com")
    api_key = os.getenv("REALSEE_API_KEY")
    if not api_key:
        raise RuntimeError("REALSEE_API_KEY is required for real scene lookup")

    url = f"{base_url}/api/v1/scenes/{scene_id}/panorama"
    r = requests.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
    r.raise_for_status()
    output_path.write_bytes(r.content)
    return {"path": str(output_path.absolute()), "source": "realsee_api"}


def fetch_metadata(scene_id: str) -> dict:
    """Fetch scene metadata."""
    if scene_id.startswith("local:") or urlparse(scene_id).scheme in ("http", "https"):
        return {
            "sceneId": scene_id,
            "name": "MVP fallback scene",
            "width": 8192,
            "height": 4096,
            "format": "equirectangular",
        }

    base_url = os.getenv("REALSEE_BASE_URL", "https://open-platform.realsee.com")
    api_key = os.getenv("REALSEE_API_KEY")
    if not api_key:
        raise RuntimeError("REALSEE_API_KEY is required for real scene lookup")

    url = f"{base_url}/api/v1/scenes/{scene_id}"
    r = requests.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
    r.raise_for_status()
    return r.json()


def main():
    parser = argparse.ArgumentParser(description="Realsee scene adapter")
    parser.add_argument("command", choices=["metadata", "panorama"])
    parser.add_argument("--scene-id", required=True)
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_DIR / "panorama.jpg"))
    args = parser.parse_args()

    try:
        if args.command == "metadata":
            print(json.dumps(fetch_metadata(args.scene_id)))
        else:
            print(json.dumps(fetch_panorama(args.scene_id, Path(args.output))))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
