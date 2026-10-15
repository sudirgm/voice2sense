# Voice 2 Sense: Multilingual Offline Translation

Consolidated offline translation module for Voice 2 Sense, integrating:
**Native Indian Language Input → Indic NLP (Normalization) → IndicTrans2 (Distilled 200M Model) → English Output**.

---

## Directory Structure
```
multilingual translation/
├── indicnlp/                             # Indic NLP Library (normalization, tokenization, scripts)
├── models/
│   └── indictrans2-indic-en-dist-200M/   # Local IndicTrans2 checkpoint (808 MB weights & vocab)
├── translator.py                         # Core offline translation engine (CLI + Python API)
├── api_server.py                         # FastAPI REST server (/translate, /translate/batch, /health)
├── test_translator.py                    # Automated test suite (Tamil, Hindi, Telugu, Kannada, Malayalam)
├── test_preprocessing_and_tokens.py     # Unit test for normalization & tokenizer tokens
├── test_sentences.py                     # Sample batch sentence translation test
├── download_model.py                     # Checkpoint setup & verification script
├── requirements.txt                      # Consolidated dependencies
├── docs/                                 # Indic NLP documentation & reference PDFs
├── contrib/                              # Indic NLP sample scripts & utilities
└── test_data/                            # Indic NLP test corpora
```

---

## Supported Languages
- **Tamil** (`ta` / `tam_Taml`)
- **Hindi** (`hi` / `hin_Deva`)
- **Telugu** (`te` / `tel_Telu`)
- **Kannada** (`kn` / `kan_Knda`)
- **Malayalam** (`ml` / `mal_Mlym`)
- **Bengali** (`bn` / `ben_Beng`)
- **Gujarati** (`gu` / `guj_Gujr`)
- **Marathi** (`mr` / `mar_Deva`)
- **Punjabi** (`pa` / `pan_Guru`)
- **Odia** (`or` / `ory_Orya`)
- **Urdu** (`ur` / `urd_Arab`)

---

## Quickstart

### 1. Run Automated Tests
Verifies offline translation for Tamil, Hindi, Telugu, Kannada, and Malayalam:
```powershell
python test_translator.py
```

### 2. Single CLI Translation
```powershell
python translator.py --text "नमस्ते दुनिया"
python translator.py --text "வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?"
```

### 3. Start the Local API Server
```powershell
python api_server.py
```
Endpoint: `http://127.0.0.1:8000`
- `POST /translate`:
  ```json
  {
    "text": "नमस्ते दुनिया",
    "src_lang": "auto"
  }
  ```
- `POST /translate/batch`:
  ```json
  {
    "texts": ["मैं स्कूल जा रहा हूँ।", "நான் பள்ளிக்கு செல்கிறேன்."],
    "src_lang": "auto"
  }
  ```
- `GET /health`
- `GET /languages`
