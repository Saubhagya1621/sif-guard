# SIF-Guard (SIH26165, Oil India Limited)

AI/NLP platform that reads free-text safety reports (UA/UC observations, near-misses, incidents), classifies each as
**SIF-potential vs non-SIF** by *potential* severity rather than actual outcome, tags the relevant **IOGP Life-Saving Rules**,
identifies the **failed barrier**, and surfaces **recurring precursor patterns across sites**. HSE reviewers correct the model,
and those corrections feed retraining.

**Live demo (demo data):** https://sif-guard-gamma.vercel.app

## What it does

- **SIF classification with explanations:** probability and confidence, plus the exact phrases that drove the score.
- **Potential severity** (fatal / serious / minor) and **barrier-failure type** (PPE, procedure, isolation, supervision, equipment, training).
- **Multi-label tagging** against the 9 IOGP Life-Saving Rules, with confidence per rule.
- **Precursor pattern mining** (HDBSCAN): e.g. "Isolation failure during pump maintenance, 6 reports across 5 sites".
- **Role-scoped dashboard:** site ranking by SIF-precursor density, trends, rule distribution, drill-down per site.
- **Human-in-the-loop:** reviewer overrides with audit trail, then one-click retraining.
- **Bulk CSV/Excel upload**, **PDF/Excel intervention-priority export**, and **high-risk alerts**.
- **Hindi/Assamese** reports detected and classified (starter glossary; see limitations).

## Architecture

```
 Browser: React 19 + Vite (:5173)
        │  fetch, credentials: include (JWT in httpOnly cookie "sifguard_token")
        ▼
 Node/Express API (:5000)  ── auth · roles · site scoping · upload pipeline · dashboard · export · audit · alerts
        │  axios, batches of 32, 60 s timeout, ML_UNAVAILABLE → rows skipped, upload never crashes
        ▼
 FastAPI ML service (:8000) ── /classify  /tag-rules  /cluster  /retrain  /metrics  /health

 MongoDB (:27017) ── users · sites · reports · auditlogs · notifications · corrections · counters
```

| Folder | Owner | What |
|---|---|---|
| `sif-guard-client/` | Dev C | React frontend (mock/real API switch via `VITE_USE_MOCK`) |
| `server/` | Dev B | Node/Express API, seed, tests, `dev/mockMl.js` stand-in ML |
| `ml-service/` | Dev A | FastAPI NLP service, synthetic dataset, training scripts, tests |
| `docs/` | shared | `API_CONTRACT.md` (source of truth), `seed_reports.json` |

## Run with Docker (one command)

Requires Docker Desktop.

```powershell
copy .env.example .env          # then set JWT_SECRET to a long random string
docker compose up --build       # mongo + ml-service + server + client
```

Open **http://localhost:5173**. The first build takes 5–10 min because the ML image trains its model. The server seeds itself on first start.

## Run locally (Windows, no Docker)

Prerequisites: **Node 20+**, **Python 3.11–3.13**, **MongoDB Community Server** (installed as a Windows service).

```powershell
copy .env.example .env                          # set JWT_SECRET; ML_SERVICE_URL=http://127.0.0.1:8000
```

**Terminal 1: ML service**
```powershell
cd ml-service
py -3.13 -m venv venv
venv\Scripts\python -m pip install -r requirements.txt -r requirements-dev.txt
venv\Scripts\python scripts\train.py            # trains models/v1 in a few seconds (first time only)
venv\Scripts\python -m uvicorn app.main:app --port 8000
```

**Terminal 2: API**
```powershell
cd server
npm install
npm run seed            # sites, demo users, reports from docs/seed_reports.json
npm run dev             # http://localhost:5000/api/health → {"db":"up","ml":"ok"}
```

**Terminal 3: frontend**
```powershell
cd sif-guard-client
npm install
# .env.local → VITE_USE_MOCK=false and VITE_API_URL=http://localhost:5000/api
npm run dev             # http://localhost:5173
```

No Python? Use `npm run mock-ml` in `server/` instead of Terminal 1 (keyword-based stand-in with the same API).

## Demo credentials

| Email | Password | Role | Sees |
|---|---|---|---|
| admin@sifguard.dev | Admin@123 | admin | everything, users, model, retrain |
| hse@sifguard.dev | Hse@1234 | hse_officer | all sites, upload, review, export |
| manager@sifguard.dev | Manager@123 | site_supervisor | Duliajan only, read-only |

## 2-minute demo script

1. Log in as **hse@**, then go to **Upload**. Click **Download sample CSV**, upload it, and watch the rows get classified.
2. Open **View this batch**. Expand a SIF report to show the highlighted phrases, rules, barrier, severity and audit trail.
3. **Apply override** on one report. It becomes *reviewed* and the audit entry appears.
4. On the **Dashboard**, show the site ranking, flagged-over-time chart and recurring patterns. Click a pattern to see the filtered reports.
5. Under **Export**, pick **Last 90 days** and download the PDF priority list.
6. Log in as **admin@**, go to **Admin**, check the pending corrections and **Trigger retrain**. The model version increments.
7. Log in as **manager@** to show the scoped view: Duliajan only, no upload, export or admin.

## Environment variables

| Var | Where | Default | Notes |
|---|---|---|---|
| `JWT_SECRET` | server | dev value | **required in production** |
| `MONGO_URI` | server | `mongodb://localhost:27017/sifguard` | |
| `ML_SERVICE_URL` | server | `http://localhost:8000` | use `http://127.0.0.1:8000` on Windows |
| `CLIENT_ORIGIN` | server | `http://localhost:5173` | comma-separated CORS allow-list |
| `NOTIFY_THRESHOLD` | server | `0.85` | SIF probability that creates an alert |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | server | `lax` / `false` | `none` / `true` when client and API are on different HTTPS domains |
| `DOCKER_ML_SERVICE_URL` | compose | `http://ml-service:8000` | `http://mock-ml:8000` to use the mock |
| `VITE_USE_MOCK` | client | demo mode if unset | `false` → real API |
| `VITE_API_URL` | client | `http://localhost:5000/api` | |

## ML approach

| Piece | Method |
|---|---|
| Training data | ~1,600 synthetic oil & gas field reports (22% SIF) with typos, abbreviations, paraphrases and hard negatives. Validation uses **held-out phrasings** never seen in training. |
| SIF classifier | TF-IDF (word + character n-grams) plus **SIF precursor features** (high-energy hazard × failed/missing control × no mitigation), class-balanced logistic regression. Optional DistilBERT ensemble (`scripts/train_transformer.py`). |
| Explainability | Leave-one-out occlusion over word windows gives `highlightedPhrases` with character offsets. |
| Rules / barrier / severity | Trained heads blended with keyword rules and embedding similarity. |
| Patterns | Embeddings + barrier/rule features, clustered with HDBSCAN. |
| Retraining | Reviewer corrections weighted 3×; a new model version is trained in seconds and hot-swapped, with previous versions kept as fallback. |

Held-out validation (synthetic): **accuracy 0.93 · SIF F1 0.89 · SIF recall 0.94 · rules F1 0.87 · barrier 0.37**.
These numbers come from synthetic data and are optimistic; real OIL reports are needed to validate production accuracy.

## Tests

```powershell
cd server; npm test                                   # 9 API tests: auth, roles, scoping, upload → review → retrain, export
cd ml-service; venv\Scripts\python -m pytest -q       # 7 contract tests
cd sif-guard-client; npm run build                    # production build check
```

## Deployment notes

- **Vercel** hosts `sif-guard-client/` (Project Settings → Root Directory = `sif-guard-client`). With `VITE_USE_MOCK` unset it runs on built-in demo data and shows a **DEMO** badge.
- To put the live site on real data: host `server/` + `ml-service/` + MongoDB (e.g. Render + Atlas), then either add a Vercel rewrite of `/api/*` to the backend (keeps cookies same-site) or set `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` and `CLIENT_ORIGIN` to the Vercel URL.

## Known limitations / roadmap

- Model trained on synthetic data only; needs OIL's labelled HSSE reports.
- Barrier-type prediction is the weakest head; reviewer overrides are the main path to improving it.
- Hindi/Assamese use a safety-term glossary, not full translation (next step: IndicTrans2); no phrase highlights for non-English text.
- Not yet built: offline/PWA field capture, OCR for scanned reports, site risk forecasting.

## Team workflow


Edit only your own folder, work on a branch, open a PR, get one review, and never push directly to `main`.
`docs/API_CONTRACT.md` changes need group agreement first.