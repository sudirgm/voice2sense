"""
Resilient multi-threaded chunk downloader for IndicTrans2 checkpoint.
Downloads and verifies model weights with automatic resume and per-chunk retry.
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

REPO_ID = "prajdabre/rotary-indictrans2-indic-en-dist-200M"
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models" / "indictrans2-indic-en-dist-200M"

BIN_FILENAME = "pytorch_model.bin"
TOTAL_SIZE = 847373378  # Exact byte size of pytorch_model.bin
DIRECT_URL = f"https://huggingface.co/{REPO_ID}/resolve/main/{BIN_FILENAME}"
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB per chunk


def get_chunks_list(total_size: int, chunk_size: int):
    chunks = []
    offset = 0
    chunk_id = 0
    while offset < total_size:
        end = min(offset + chunk_size - 1, total_size - 1)
        chunks.append({"id": chunk_id, "start": offset, "end": end, "size": end - offset + 1})
        offset = end + 1
        chunk_id += 1
    return chunks


def download_single_chunk(url: str, filepath: Path, chunk: dict, max_retries: int = 5):
    chunk_id = chunk["id"]
    start = chunk["start"]
    end = chunk["end"]
    expected_len = chunk["size"]

    headers = {"Range": f"bytes={start}-{end}"}

    for attempt in range(1, max_retries + 1):
        try:
            with requests.get(url, headers=headers, stream=True, timeout=25) as resp:
                resp.raise_for_status()
                data = resp.content
                if len(data) != expected_len:
                    raise IOError(f"Chunk {chunk_id} length mismatch: got {len(data)}, expected {expected_len}")

                with open(filepath, "r+b") as f:
                    f.seek(start)
                    f.write(data)
                return chunk_id
        except Exception as e:
            if attempt == max_retries:
                print(f"\nFailed chunk {chunk_id} after {max_retries} attempts: {e}")
                raise
            time.sleep(1.5 * attempt)


def download_pytorch_model_bin(dest_path: Path, max_workers: int = 12):
    tmp_path = dest_path.with_suffix(".bin.tmp")
    done_file = MODEL_DIR / "chunks_done.json"

    # Ensure pre-allocated file exists
    if not tmp_path.exists() or tmp_path.stat().st_size != TOTAL_SIZE:
        print(f"Allocating {TOTAL_SIZE / (1024 * 1024):.1f} MB file...")
        with open(tmp_path, "wb") as f:
            f.truncate(TOTAL_SIZE)

    chunks = get_chunks_list(TOTAL_SIZE, CHUNK_SIZE)
    total_chunks = len(chunks)

    done_set = set()
    if done_file.exists():
        try:
            with open(done_file, "r") as f:
                done_set = set(json.load(f))
        except Exception:
            done_set = set()

    remaining_chunks = [c for c in chunks if c["id"] not in done_set]
    print(f"Total chunks: {total_chunks} (8 MB each). Already completed: {len(done_set)}. Remaining: {len(remaining_chunks)}.")

    start_time = time.time()
    downloaded_bytes_session = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_chunk = {
            executor.submit(download_single_chunk, DIRECT_URL, tmp_path, chunk): chunk
            for chunk in remaining_chunks
        }

        for future in as_completed(future_to_chunk):
            chunk = future_to_chunk[future]
            chunk_id = future.result()
            done_set.add(chunk_id)
            downloaded_bytes_session += chunk["size"]

            # Save progress periodically
            with open(done_file, "w") as f:
                json.dump(list(done_set), f)

            elapsed = time.time() - start_time
            speed = (downloaded_bytes_session / (1024 * 1024)) / elapsed if elapsed > 0 else 0
            completed_bytes = len(done_set) * CHUNK_SIZE
            pct = min(100.0, (completed_bytes / TOTAL_SIZE) * 100)

            print(
                f"Completed: {len(done_set)}/{total_chunks} chunks ({pct:.1f}%) | "
                f"Speed: {speed:.2f} MB/s",
                end="\r",
                flush=True,
            )

    print(f"\nAll {total_chunks} chunks verified and downloaded successfully!")

    # Verify final file size
    if tmp_path.stat().st_size != TOTAL_SIZE:
        raise ValueError(f"Final size mismatch: {tmp_path.stat().st_size} vs {TOTAL_SIZE}")

    if dest_path.exists():
        dest_path.unlink()
    tmp_path.rename(dest_path)

    if done_file.exists():
        done_file.unlink()

    print(f"Successfully finalized: {dest_path}")


def download_model():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    dest_bin = MODEL_DIR / BIN_FILENAME

    if dest_bin.exists() and dest_bin.stat().st_size == TOTAL_SIZE:
        print(f"Model weights are already complete ({dest_bin.stat().st_size / (1024 * 1024):.1f} MB).")
        return str(MODEL_DIR)

    print(f"Downloading IndicTrans2 weights to: {dest_bin}")
    download_pytorch_model_bin(dest_bin, max_workers=12)
    return str(MODEL_DIR)


if __name__ == "__main__":
    download_model()
