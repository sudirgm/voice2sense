"""
FastAPI REST API Server for Voice 2 Sense Offline Translation Service.
Provides offline translation endpoints for native Indian languages to English.
"""

import sys
from pathlib import Path
from typing import List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Ensure local module is importable
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

import base64
from translator import IndicTrans2Translator, LANGUAGE_CONFIG, detect_indic_script, get_translator

app = FastAPI(
    title="Voice 2 Sense - Offline Multilingual Translation API",
    description="Offline translation from Indian native languages to English using IndicTrans2 and Indic NLP Library.",
    version="1.0.0",
)

# Enable CORS for local web applications (e.g. Vite frontend on localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount BVH files directory
bvh_dir = BASE_DIR.parent / "Train"
if bvh_dir.exists():
    app.mount("/bvh", StaticFiles(directory=str(bvh_dir)), name="bvh")
else:
    print(f"Warning: BVH directory {bvh_dir} not found. 3D avatar animations will not load.")


class SpeechProcessRequest(BaseModel):
    text: Optional[str] = Field(None, description="Direct text input in native Indian language or English")
    audio_base64: Optional[str] = Field(None, description="Base64 encoded audio (WAV/WEBM/OGG)")
    src_lang: Optional[str] = Field("auto", description="Source language code ('auto', 'ta', 'hi', 'te', 'kn', 'ml', etc.)")


class SpeechProcessResponse(BaseModel):
    success: bool
    detected_language: str
    transcription: str
    normalized_text: str
    english_text: str
    error: Optional[str] = None


class TranslationRequest(BaseModel):
    text: str = Field(..., description="Indian-language text to translate into English")
    src_lang: Optional[str] = Field("auto", description="Source language code ('auto', 'ta', 'hi', 'te', 'kn', 'ml', etc.)")
    num_beams: Optional[int] = Field(4, description="Number of beams for beam search generation")


class BatchTranslationRequest(BaseModel):
    texts: List[str] = Field(..., description="List of Indian-language sentences to translate")
    src_lang: Optional[str] = Field("auto", description="Source language code or 'auto'")
    num_beams: Optional[int] = Field(4, description="Number of beams for beam search generation")


class TranslationResponse(BaseModel):
    original_text: str
    normalized_text: str
    detected_lang: str
    src_lang: str
    tgt_lang: str
    translated_text: str


@app.on_event("startup")
def startup_event():
    print("Pre-loading IndicTrans2 model...")
    try:
        get_translator()
        print("Model pre-loaded successfully.")
    except Exception as e:
        print(f"Warning: Model not preloaded on startup ({e}). It will load on first request.")


@app.get("/health")
def health_check():
    try:
        translator = get_translator()
        return {
            "status": "online",
            "device": str(translator.device),
            "model_dir": str(translator.model_dir),
            "offline_mode": True,
        }
    except Exception as e:
        return {
            "status": "uninitialized",
            "error": str(e),
            "offline_mode": True,
        }


@app.get("/languages")
def list_languages():
    return {
        "supported_languages": [
            {"code": k, "name": v["name"], "flores_tag": v["tag"], "indic_nlp_code": v["indic_nlp"]}
            for k, v in LANGUAGE_CONFIG.items()
        ],
        "default_target": "eng_Latn",
    }


@app.post("/process_speech", response_model=SpeechProcessResponse)
def process_speech(req: SpeechProcessRequest):
    """
    End-to-end Offline Speech / Text processing pipeline:
    Audio / Text -> Offline ASR -> Language Detection -> Indic NLP -> IndicTrans2 -> English.
    """
    try:
        transcription = ""
        detected_language = "en"

        # 1. Speech Recognition (Offline Whisper) if audio provided
        if req.audio_base64:
            try:
                from asr import get_asr
                audio_bytes = base64.b64decode(req.audio_base64)
                asr = get_asr()
                asr_res = asr.transcribe_bytes(audio_bytes)
                if not asr_res.get("success"):
                    raise RuntimeError(asr_res.get("error", "ASR transcription failed"))
                transcription = asr_res["transcription"].strip()
                detected_language = asr_res["detected_language"]
            except Exception as e:
                print(f"[ASR ERROR] {e}")
                return SpeechProcessResponse(
                    success=False,
                    detected_language="en",
                    transcription="",
                    normalized_text="",
                    english_text="",
                    error=f"ASR error: {e}"
                )
        elif req.text:
            transcription = req.text.strip()
            detected_language = detect_indic_script(transcription) or "en"
        else:
            return SpeechProcessResponse(
                success=False,
                detected_language="en",
                transcription="",
                normalized_text="",
                english_text="",
                error="Either 'text' or 'audio_base64' must be provided"
            )

        if not transcription:
            return SpeechProcessResponse(
                success=True,
                detected_language="en",
                transcription="",
                normalized_text="",
                english_text=""
            )

        print(f"[ASR] detected language: {detected_language}")
        print(f"[ASR] transcription: {transcription}")

        # 2. Check if already English (all ASCII Latin characters and no Indic script)
        is_english = detected_language == "en" and all(ord(c) < 128 for c in transcription)
        if is_english:
            print(f"[TRANSLATION] source: {transcription}")
            print(f"[TRANSLATION] English: {transcription}")
            return SpeechProcessResponse(
                success=True,
                detected_language="en",
                transcription=transcription,
                normalized_text=transcription,
                english_text=transcription
            )

        # 3. Indic NLP Normalization & IndicTrans2 Translation
        print(f"[TRANSLATION] source: {transcription}")
        translator = get_translator()
        trans_res = translator.translate(
            text=transcription,
            src_lang=detected_language if detected_language != "auto" else (req.src_lang or "auto"),
            num_beams=2
        )

        english_text = trans_res["translated_text"]
        normalized_text = trans_res["normalized_text"]
        detected_lang = trans_res["detected_lang"]

        print(f"[TRANSLATION] English: {english_text}")

        return SpeechProcessResponse(
            success=True,
            detected_language=detected_lang,
            transcription=transcription,
            normalized_text=normalized_text,
            english_text=english_text
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PIPELINE ERROR] {e}")
        return SpeechProcessResponse(
            success=False,
            detected_language="en",
            transcription="",
            normalized_text="",
            english_text="",
            error=str(e)
        )


@app.post("/translate", response_model=TranslationResponse)
def translate(req: TranslationRequest):
    try:
        translator = get_translator()
        result = translator.translate(
            text=req.text,
            src_lang=req.src_lang or "auto",
            num_beams=req.num_beams or 4,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/translate/batch", response_model=List[TranslationResponse])
def translate_batch(req: BatchTranslationRequest):
    try:
        translator = get_translator()
        results = translator.translate_batch(
            texts=req.texts,
            src_langs=req.src_lang or "auto",
            num_beams=req.num_beams or 4,
        )
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def start(host: str = "127.0.0.1", port: int = 8000):
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    start()
