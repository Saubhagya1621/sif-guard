# SIF-Guard ML service (FastAPI, port 8000)

Implements `docs/API_CONTRACT.md` §3: `/health`, `/classify`, `/tag-rules`, `/cluster`, `/retrain`, `/metrics`.
Called only by the Node backend.

## Run (Windows, Python 3.11)
```powershell
cd ml-service
py -3.11 -m venv venv
venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt
venv\Scripts\python scripts\generate_data.py      # data/train.csv + data/validation.csv
venv\Scripts\python scripts\train.py              # models/v1 (~30-60 s)
venv\Scripts\python -m pytest -q                  # 7 contract tests
venv\Scripts\python -m uvicorn app.main:app --port 8000
```
(Stop the backend's `npm run mock-ml` first; it uses the same port.)

Optional DistilBERT + MiniLM tier:
```powershell
venv\Scripts\python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
venv\Scripts\python -m pip install -r requirements-transformers.txt
venv\Scripts\python scripts\train_transformer.py   # ~5-15 min on CPU → models/transformer
```
Restart uvicorn: `/health` then reports e.g. `v1+distilbert`.

## How it works
| Piece | Method |
|---|---|
| Dataset | `app/datagen.py`: ~1600 synthetic field reports, 22% SIF, typos/abbreviations/long+short variants, hard negatives. Validation = **held-out templates** (never seen in training). Review `data/validation.csv`. |
| SIF classifier | TF-IDF (word 1-2 + char 3-5 grams) + class-balanced logistic regression; optionally ensembled 0.6/0.4 with fine-tuned DistilBERT (weighted loss). |
| Explainability | Leave-one-out occlusion over 1-3 word windows → `highlightedPhrases` with offsets into the original text. |
| Potential severity / barrier | Separate logistic heads on the same features; SIF ⇒ at least "serious" and a non-"none" barrier. |
| Life-Saving Rules | 0.55 multi-label head + 0.30 keyword/regex rules + 0.15 embedding similarity to rule descriptions; ≥ 0.4, max 3. |
| Entities | spaCy PhraseMatcher rules + regex for site codes (GGS-4, Rig DJN-12, Well pad 3). |
| Clustering | Embeddings (MiniLM or LSA) + barrier/rule one-hots → HDBSCAN (min_cluster_size 3); labels from the most common activity/barrier/rule. |
| Retraining | Corrections appended to `data/corrections.jsonl`, weighted 3×, new version `vN+1` trained (seconds), hot-swapped; old versions kept as fallback. |
| Hindi/Assamese | Script detection + safety-term glossary to English (starter; replace with IndicTrans2). No highlight offsets for non-English. |

## Honest limitations
- Metrics are measured on synthetic data and are optimistic; real OIL reports are needed to validate.
- `/retrain` retrains the fast tier only; DistilBERT is retrained with `scripts/train_transformer.py`.
- Model files are not committed (`models/` is git-ignored); they are trained on first run or at Docker build.
