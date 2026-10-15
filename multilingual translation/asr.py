"""
Offline ASR (Automatic Speech Recognition) Engine for Voice 2 Sense.
Uses local Whisper (openai/whisper-tiny) running locally on CPU.
Transcribes spoken native Indian languages (and English) and identifies language.
"""

import io
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Union

import numpy as np
import soundfile as sf
import torch
from transformers import WhisperForConditionalGeneration, WhisperProcessor

# Add local path
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = BASE_DIR / "models" / "whisper-tiny"

# Ensure translator script detection is importable
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from translator import detect_indic_script, LANGUAGE_CONFIG

_ASR_INSTANCE = None


class OfflineWhisperASR:
    def __init__(self, model_dir: Optional[Union[str, Path]] = None, device: Optional[str] = None):
        self.model_dir = Path(model_dir or DEFAULT_MODEL_DIR)
        if not self.model_dir.exists():
            raise FileNotFoundError(
                f"Whisper model directory not found at {self.model_dir}. "
                f"Please run 'python download_whisper.py' first."
            )

        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        print(f"[ASR] Loading local Whisper model from {self.model_dir} on {self.device}...")

        self.processor = WhisperProcessor.from_pretrained(str(self.model_dir), local_files_only=True)
        self.model = WhisperForConditionalGeneration.from_pretrained(str(self.model_dir), local_files_only=True)
        self.model.to(self.device)
        self.model.eval()
        print("[ASR] Whisper offline engine initialized successfully.")

    def transcribe(self, audio_data: np.ndarray, sampling_rate: int = 16000) -> Dict[str, Any]:
        """
        Transcribe audio array (16kHz float32 or int16) to text and identify language.
        """
        if audio_data.dtype != np.float32:
            audio_data = audio_data.astype(np.float32)

        # Normalize audio amplitude if needed
        max_val = np.max(np.abs(audio_data))
        if max_val > 1.0:
            audio_data = audio_data / 32768.0

        input_features = self.processor(
            audio_data,
            sampling_rate=sampling_rate,
            return_tensors="pt"
        ).input_features.to(self.device)

        with torch.no_grad():
            # Generate transcription in original spoken language (task="transcribe")
            predicted_ids = self.model.generate(
                input_features,
                task="transcribe",
                num_beams=2,
                max_new_tokens=128
            )

        transcription = self.processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()

        # Deterministic script/language detection on the native transcription
        # Default to English ('en') if no Indic script is detected (e.g. Latin alphabet)
        detected_lang = detect_indic_script(transcription) or "en"

        return {
            "transcription": transcription,
            "detected_language": detected_lang,
            "success": True
        }

    def transcribe_bytes(self, audio_bytes: bytes) -> Dict[str, Any]:
        """
        Transcribe audio byte buffer (WebM, WAV, etc.) by decoding with ffmpeg.
        """
        try:
            import subprocess
            import imageio_ffmpeg
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

            cmd = [
                ffmpeg_exe,
                '-y',
                '-i', 'pipe:0',
                '-f', 'wav',
                '-ar', '16000',
                '-ac', '1',
                'pipe:1'
            ]
            process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            wav_bytes, err = process.communicate(input=audio_bytes)

            if process.returncode != 0:
                # Fallback to direct soundfile read in case it's a raw WAV or ffmpeg failed
                with io.BytesIO(audio_bytes) as buf:
                    audio_data, sr = sf.read(buf)
            else:
                with io.BytesIO(wav_bytes) as buf:
                    audio_data, sr = sf.read(buf)

            # Convert multi-channel to mono
            if len(audio_data.shape) > 1:
                audio_data = np.mean(audio_data, axis=1)

            # Resample to 16kHz if different
            if sr != 16000:
                try:
                    import librosa
                    audio_data = librosa.resample(audio_data.astype(np.float32), orig_sr=sr, target_sr=16000)
                except Exception:
                    pass

            return self.transcribe(audio_data, sampling_rate=16000)
        except Exception as e:
            return {
                "transcription": "",
                "detected_language": "en",
                "success": False,
                "error": str(e)
            }


def get_asr() -> OfflineWhisperASR:
    global _ASR_INSTANCE
    if _ASR_INSTANCE is None:
        _ASR_INSTANCE = OfflineWhisperASR()
    return _ASR_INSTANCE
