"""
Isolated Offline Multilingual Translation Engine for Voice 2 Sense.
Uses IndicTrans2 (prajdabre/rotary-indictrans2-indic-en-dist-200M) for translation,
and the local Indic NLP Library exclusively for text preprocessing/normalization.
"""

import os
import sys
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

# Setup paths to local Indic NLP library and local model directory
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_DIR = BASE_DIR / "models" / "indictrans2-indic-en-dist-200M"

# Ensure local directories are on sys.path (do NOT add indicnlp subfolder directly to avoid shadowing stdlib tokenize)
for p in [str(BASE_DIR), str(DEFAULT_MODEL_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Import local Indic NLP Library normalizer
try:
    from indicnlp.normalize.indic_normalize import IndicNormalizerFactory
    _NORMALIZER_FACTORY = IndicNormalizerFactory()
except ImportError as e:
    _NORMALIZER_FACTORY = None
    print(f"Warning: Unable to import IndicNormalizerFactory from {INDIC_NLP_DIR}: {e}")

# Mapping of short codes to FLORES-200 tags and Indic NLP language codes
LANGUAGE_CONFIG = {
    "ta": {"tag": "tam_Taml", "indic_nlp": "ta", "name": "Tamil"},
    "hi": {"tag": "hin_Deva", "indic_nlp": "hi", "name": "Hindi"},
    "te": {"tag": "tel_Telu", "indic_nlp": "te", "name": "Telugu"},
    "kn": {"tag": "kan_Knda", "indic_nlp": "kn", "name": "Kannada"},
    "ml": {"tag": "mal_Mlym", "indic_nlp": "ml", "name": "Malayalam"},
    "bn": {"tag": "ben_Beng", "indic_nlp": "bn", "name": "Bengali"},
    "gu": {"tag": "guj_Gujr", "indic_nlp": "gu", "name": "Gujarati"},
    "mr": {"tag": "mar_Deva", "indic_nlp": "mr", "name": "Marathi"},
    "pa": {"tag": "pan_Guru", "indic_nlp": "pa", "name": "Punjabi"},
    "or": {"tag": "ory_Orya", "indic_nlp": "or", "name": "Odia"},
    "ur": {"tag": "urd_Arab", "indic_nlp": "ur", "name": "Urdu"},
    "sa": {"tag": "san_Deva", "indic_nlp": "sa", "name": "Sanskrit"},
    "en": {"tag": "eng_Latn", "indic_nlp": "en", "name": "English"},
}

# Add reverse lookup for full tags and aliases
TAG_TO_LANG = {}
for code, info in LANGUAGE_CONFIG.items():
    TAG_TO_LANG[code.lower()] = info
    TAG_TO_LANG[info["tag"].lower()] = info
    TAG_TO_LANG[info["name"].lower()] = info
    # Handle standard 3-letter codes
    prefix = info["tag"].split("_")[0].lower()
    TAG_TO_LANG[prefix] = info


def detect_indic_script(text: str) -> Optional[str]:
    """
    Detect the Indic language/script deterministically from Unicode character ranges.
    Returns language key: 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'gu', 'pa', 'or', 'ur', or None.
    """
    script_counts = {
        "ta": 0,  # Tamil: 0x0B80 - 0x0BFF
        "te": 0,  # Telugu: 0x0C00 - 0x0C7F
        "kn": 0,  # Kannada: 0x0C80 - 0x0CFF
        "ml": 0,  # Malayalam: 0x0D00 - 0x0D7F
        "hi": 0,  # Devanagari (Hindi): 0x0900 - 0x097F
        "bn": 0,  # Bengali: 0x0980 - 0x09FF
        "gu": 0,  # Gujarati: 0x0A80 - 0x0AFF
        "pa": 0,  # Gurmukhi: 0x0A00 - 0x0A7F
        "or": 0,  # Odia: 0x0B00 - 0x0B7F
        "ur": 0,  # Arabic/Urdu: 0x0600 - 0x06FF
    }

    for ch in text:
        cp = ord(ch)
        if 0x0B80 <= cp <= 0x0BFF:
            script_counts["ta"] += 1
        elif 0x0C00 <= cp <= 0x0C7F:
            script_counts["te"] += 1
        elif 0x0C80 <= cp <= 0x0CFF:
            script_counts["kn"] += 1
        elif 0x0D00 <= cp <= 0x0D7F:
            script_counts["ml"] += 1
        elif 0x0900 <= cp <= 0x097F:
            script_counts["hi"] += 1
        elif 0x0980 <= cp <= 0x09FF:
            script_counts["bn"] += 1
        elif 0x0A80 <= cp <= 0x0AFF:
            script_counts["gu"] += 1
        elif 0x0A00 <= cp <= 0x0A7F:
            script_counts["pa"] += 1
        elif 0x0B00 <= cp <= 0x0B7F:
            script_counts["or"] += 1
        elif 0x0600 <= cp <= 0x06FF:
            script_counts["ur"] += 1

    max_lang = max(script_counts, key=script_counts.get)
    if script_counts[max_lang] > 0:
        return max_lang
    return None


class IndicTrans2Translator:
    """
    Offline translation service using IndicTrans2 and Indic NLP Library preprocessing.
    """

    def __init__(
        self,
        model_dir: Optional[Union[str, Path]] = None,
        device: Optional[str] = None,
    ):
        self.model_dir = Path(model_dir or DEFAULT_MODEL_DIR)
        if not self.model_dir.exists():
            raise FileNotFoundError(
                f"Model checkpoint directory not found at {self.model_dir}. "
                f"Please run download_model.py first."
            )

        if device:
            self.device = torch.device(device)
        else:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        print(f"Loading IndicTrans2 model from {self.model_dir} on {self.device}...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            str(self.model_dir),
            trust_remote_code=True,
            local_files_only=True,
        )

        self.model = AutoModelForSeq2SeqLM.from_pretrained(
            str(self.model_dir),
            trust_remote_code=True,
            local_files_only=True,
        ).to(self.device)
        self.model.eval()

        self.normalizer_cache = {}
        print("IndicTrans2 model successfully initialized and ready for offline inference.")

    def normalize_text(self, text: str, lang_code: str) -> str:
        """
        Normalize text using the local Indic NLP Library.
        """
        if not _NORMALIZER_FACTORY:
            return text.strip()

        lang_info = TAG_TO_LANG.get(lang_code.lower())
        indic_lang = lang_info["indic_nlp"] if lang_info else lang_code.lower()

        if indic_lang not in self.normalizer_cache:
            try:
                self.normalizer_cache[indic_lang] = _NORMALIZER_FACTORY.get_normalizer(indic_lang)
            except Exception:
                self.normalizer_cache[indic_lang] = None

        normalizer = self.normalizer_cache.get(indic_lang)
        if normalizer:
            try:
                text = normalizer.normalize(text)
            except Exception as e:
                print(f"Warning: indicnlp normalization error for {indic_lang}: {e}")

        # Canonicalize extra whitespace
        return " ".join(text.split()).strip()

    def resolve_language(self, text: str, src_lang: Optional[str] = "auto") -> Tuple[str, str]:
        """
        Determine source FLORES tag and short language code.
        Returns: (flores_tag, lang_code)
        """
        if src_lang and src_lang.lower() != "auto":
            key = src_lang.lower().strip()
            if key in TAG_TO_LANG:
                info = TAG_TO_LANG[key]
                return info["tag"], info["indic_nlp"]

        # Automatic detection from script
        detected = detect_indic_script(text)
        if detected and detected in LANGUAGE_CONFIG:
            info = LANGUAGE_CONFIG[detected]
            return info["tag"], info["indic_nlp"]

        # Default fallback to Hindi if undetectable
        return "hin_Deva", "hi"

    def translate(
        self,
        text: str,
        src_lang: str = "auto",
        num_beams: int = 4,
        max_length: int = 256,
    ) -> Dict[str, Union[str, float]]:
        """
        Translate a single input string to English.
        """
        if not text or not text.strip():
            return {
                "original_text": text,
                "detected_lang": "",
                "src_lang": "",
                "tgt_lang": "eng_Latn",
                "translated_text": "",
            }

        flores_src, short_code = self.resolve_language(text, src_lang)

        # 1. Preprocessing / Normalization using Indic NLP Library
        normalized_text = self.normalize_text(text, short_code)

        # 2. Format input for IndicTrans2: "<src_tag> <tgt_tag> <text>"
        formatted_prompt = f"{flores_src} eng_Latn {normalized_text}"

        # 3. Tokenize
        inputs = self.tokenizer(
            [formatted_prompt],
            padding="longest",
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        ).to(self.device)

        # 4. Generate translation
        with torch.inference_mode():
            outputs = self.model.generate(
                **inputs,
                num_beams=num_beams,
                max_length=max_length,
                early_stopping=True,
            )

        # 5. Decode output to English
        decoded = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)
        translated_text = decoded[0].strip() if decoded else ""

        return {
            "original_text": text,
            "normalized_text": normalized_text,
            "detected_lang": short_code,
            "src_lang": flores_src,
            "tgt_lang": "eng_Latn",
            "translated_text": translated_text,
        }

    def translate_batch(
        self,
        texts: List[str],
        src_langs: Optional[Union[str, List[str]]] = "auto",
        num_beams: int = 4,
        max_length: int = 256,
    ) -> List[Dict[str, Union[str, float]]]:
        """
        Translate a batch of sentences to English.
        """
        if not texts:
            return []

        if isinstance(src_langs, str):
            src_langs = [src_langs] * len(texts)
        elif len(src_langs) != len(texts):
            raise ValueError("Length of src_langs must match length of texts.")

        formatted_prompts = []
        metadata_list = []

        for text, lang in zip(texts, src_langs):
            if not text or not text.strip():
                formatted_prompts.append("hin_Deva eng_Latn ")
                metadata_list.append((text, "", "hin_Deva", "hi"))
                continue

            flores_src, short_code = self.resolve_language(text, lang)
            normalized = self.normalize_text(text, short_code)
            formatted_prompts.append(f"{flores_src} eng_Latn {normalized}")
            metadata_list.append((text, normalized, flores_src, short_code))

        inputs = self.tokenizer(
            formatted_prompts,
            padding="longest",
            truncation=True,
            max_length=max_length,
            return_tensors="pt",
        ).to(self.device)

        with torch.inference_mode():
            outputs = self.model.generate(
                **inputs,
                num_beams=num_beams,
                max_length=max_length,
                early_stopping=True,
            )

        decoded = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)

        results = []
        for (orig, norm, flores_src, short_code), translation in zip(metadata_list, decoded):
            results.append({
                "original_text": orig,
                "normalized_text": norm,
                "detected_lang": short_code,
                "src_lang": flores_src,
                "tgt_lang": "eng_Latn",
                "translated_text": translation.strip(),
            })

        return results


# Global singleton instance for easy import and reuse
_GLOBAL_TRANSLATOR = None


def get_translator(model_dir: Optional[str] = None) -> IndicTrans2Translator:
    global _GLOBAL_TRANSLATOR
    if _GLOBAL_TRANSLATOR is None:
        _GLOBAL_TRANSLATOR = IndicTrans2Translator(model_dir=model_dir)
    return _GLOBAL_TRANSLATOR


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Voice 2 Sense Offline Translator (IndicTrans2)")
    parser.add_argument("--text", type=str, help="Text to translate to English")
    parser.add_argument("--lang", type=str, default="auto", help="Source language code (e.g. 'ta', 'hi', 'te', 'kn', 'ml')")
    args = parser.parse_args()

    if args.text:
        translator = get_translator()
        res = translator.translate(args.text, src_lang=args.lang)
        print("\n--- Translation Result ---")
        print(f"Input:       {res['original_text']}")
        print(f"Language:    {res['detected_lang']} ({res['src_lang']})")
        print(f"Translation: {res['translated_text']}")
    else:
        print("Usage: python translator.py --text 'नमस्ते दुनिया' [--lang hi]")
