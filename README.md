# SIF-Guard (SIH26165, Oil India Limited)

AI/NLP platform that classifies safety reports as SIF-potential vs non-SIF, tags them to IOGP Life-Saving Rules, and shows recurring risk patterns on a dashboard.

## Structure
- sif-guard-client/ : React frontend (port 5173)
- server/ : Node/Express API (port 5000)
- ml-service/ : Python FastAPI NLP service (port 8000)
- docs/API_CONTRACT.md : shared API contract (source of truth)

## Rules
- Only edit files inside your own folder.
- Work on your own branch and open a Pull Request; never push directly to main.
- Copy .env.example to .env and fill in values.
