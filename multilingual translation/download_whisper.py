"""
Downloader for openai/whisper-tiny checkpoint for offline speech recognition.
Downloads weights directly into models/whisper-tiny.
"""

import os
import sys
from pathlib import Path
import requests

REPO_ID = "openai/whisper-tiny"
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models" / "whisper-tiny"

FILES = [
    "config.json",
    "generation_config.json",
    "model.safetensors",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "vocab.json",
    "special_tokens_map.json",
    "normalizer.json"
]


def download_file(filename: str, output_dir: Path):
    dest = output_dir / filename
    if dest.exists() and dest.stat().st_size > 100:
        print(f"[OK] {filename} already exists ({dest.stat().st_size} bytes)")
        return True

    url = f"https://huggingface.co/{REPO_ID}/resolve/main/{filename}"
    print(f"[DOWNLOADING] {filename} from {url}...")
    headers = {"User-Agent": "Voice2Sense-Downloader"}

    try:
        with requests.get(url, headers=headers, stream=True, timeout=30) as r:
            r.raise_for_status()
            total_bytes = int(r.headers.get("content-length", 0))
            downloaded = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=512 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_bytes > 0:
                            pct = (downloaded / total_bytes) * 100
                            print(f"\r  -> {filename}: {pct:.1f}% ({downloaded / (1024*1024):.1f} MB / {total_bytes / (1024*1024):.1f} MB)", end="")
            print(f"\n[DONE] {filename} saved successfully.")
            return True
    except Exception as e:
        print(f"\n[ERROR] Failed to download {filename}: {e}")
        if dest.exists():
            dest.unlink()
        return False


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Target directory: {MODEL_DIR}")
    all_success = True
    for fname in FILES:
        success = download_file(fname, MODEL_DIR)
        if not success:
            all_success = False

    if all_success:
        print("\nAll whisper-tiny model files downloaded and ready for offline use!")
    else:
        print("\nSome files failed to download. Please retry.")


if __name__ == "__main__":
    main()
