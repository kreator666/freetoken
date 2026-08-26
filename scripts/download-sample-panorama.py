"""Download a sample equirectangular panorama from Wikimedia Commons."""

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets" / "panorama-real.jpg"

# Wikimedia Commons: Landschaftspark Duisburg-Nord Hochofen Panorama (1920px thumbnail)
URL = (
    "https://upload.wikimedia.org/wikipedia/commons/thumb/"
    "7/7e/Landschaftspark-Duisburg-Nord_Hochofen_Panorama.jpg/"
    "1920px-Landschaftspark-Duisburg-Nord_Hochofen_Panorama.jpg"
)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "dsh-realsee-agent-demo/0.1 (contact: dev@example.org)",
            "Accept": "image/jpeg",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        OUTPUT.write_bytes(resp.read())
    print(f"Saved sample panorama to {OUTPUT}")


if __name__ == "__main__":
    main()
