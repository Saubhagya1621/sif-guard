# SIF-Guard (SIH26165, Oil India Limited)

AI/NLP platform that classifies free-text safety reports (UA/UC, near-miss, incident) as **SIF-potential vs non-SIF**,
tags them to the **9 IOGP Life-Saving Rules**, identifies the failed barrier, and surfaces recurring precursor patterns
on a role-scoped dashboard, with human review feeding model retraining.

## Architecture

```
 Browser (React, :5173)
        │  fetch, credentials: include (JWT in httpOnly cookie "sifguard_token")
        ▼
 Node/Express API (:5000)  ── auth · roles · site scoping · upload pipeline · dashboard · export · audit
        │  axios, batches of 32, 60 s timeout, ML_UNAVAILABLE on failure
        ▼
 FastAPI ML service (:8000) ── /classify  /tag-rules  /cluster  /retrain  /metrics
        
 MongoDB (:27017) ── users · sites · reports · auditlogs · notifications · corrections · counters
```

## Repo layout and ownership

| Folder | Owner | What |
|---|---|---|
| `sif-guard-client/` | Dev C | React 19 + Vite frontend |
| `server/` | Dev B | Node/Express API (+ `dev/mockMl.js` stand-in for the ML service) |
| `ml-service/` | Dev A | FastAPI NLP service |
| `docs/` | shared | `API_CONTRACT.md` (source of truth), `seed_reports.json` |

Only edit your own folder, work on your branch, open a PR; never push to `main`.

## Run with Docker

```bash
cp .env.example .env                      # set JWT_SECRET
docker compose up --build                 # mongo + ml-service + server + client
```
Until the real ML service is merged, use the mock:
```bash
DOCKER_ML_SERVICE_URL=http://mock-ml:8000 docker compose up --build mongo mock-ml server client
```
Open http://localhost:5173. The server seeds itself on first start (idempotent).

## Run locally (without Docker)

```bash
cp .env.example .env
# MongoDB on localhost:27017 (e.g. docker run -d -p 27017:27017 mongo:7)
cd server && npm install
npm run mock-ml        # terminal 1: mock ML on :8000 (or run the real ml-service)
npm run seed           # sites, demo users, seed reports
npm run dev            # terminal 2: API on :5000
npm run sample-csv     # writes server/dev/sample_upload.csv (43 rows incl. Hindi + 2 bad rows)
npm test               # jest + supertest (in-memory Mongo)
```

## Demo credentials

| Email | Password | Role | Site |
|---|---|---|---|
| admin@sifguard.dev | Admin@123 | admin | all |
| hse@sifguard.dev | Hse@1234 | hse_officer | all |
| manager@sifguard.dev | Manager@123 | site_supervisor | duliajan |

## Environment variables

| Var | Default | Notes |
|---|---|---|
| `PORT` | 5000 | |
| `MONGO_URI` | mongodb://localhost:27017/sifguard | |
| `JWT_SECRET` | dev value | **required in production** |
| `CLIENT_ORIGIN` | http://localhost:5173 | comma-separated CORS allow-list |
| `ML_SERVICE_URL` | http://localhost:8000 | |
| `NOTIFY_THRESHOLD` | 0.85 | SIF probability that creates a notification |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | lax / false | use `none` / `true` when client and API are on different HTTPS domains |

## API summary (details: `docs/API_CONTRACT.md`)

| Area | Endpoints | Access |
|---|---|---|
| Auth | `POST /api/auth/login` · `POST /logout` · `GET /me` · `POST /register` | register: admin |
| Reports | `POST /api/reports/upload` · `GET /api/reports` · `GET /:id` · `PATCH /:id/review` | upload/review: admin, hse_officer |
| Dashboard | `GET /api/dashboard/summary · sites · patterns · trends · rules` | all roles, supervisor = own site |
| Export | `GET /api/export?format=pdf\|xlsx&from&to` | admin, hse_officer |
| Admin | `GET/PATCH /api/admin/users` · `GET /admin/model` · `POST /admin/retrain` | admin |
| Notifications | `GET /api/notifications` · `PATCH /:id/read` | all roles, scoped |
| Health | `GET /api/health` | public |

Errors always look like `{ "error": { "code": "FORBIDDEN", "message": "..." } }`.

## Quick curl check

```bash
curl -c jar -H 'Content-Type: application/json' -d '{"email":"hse@sifguard.dev","password":"Hse@1234"}' localhost:5000/api/auth/login
curl -b jar -F file=@server/dev/sample_upload.csv localhost:5000/api/reports/upload
curl -b jar 'localhost:5000/api/reports?classification=SIF&limit=5'
curl -b jar localhost:5000/api/dashboard/sites
curl -b jar -o list.pdf 'localhost:5000/api/export?format=pdf'
```
