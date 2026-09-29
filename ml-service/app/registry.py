"""Versioned model storage: models/v1, models/v2 ... plus models/current.json pointing at the active one.
Old versions are kept as fallbacks."""
import json
import os
from pathlib import Path

import joblib

BASE = Path(__file__).resolve().parent.parent
MODELS_DIR = Path(os.getenv("MODELS_DIR", BASE / "models"))
DATA_DIR = Path(os.getenv("DATA_DIR", BASE / "data"))
POINTER = MODELS_DIR / "current.json"
TRANSFORMER_DIR = MODELS_DIR / "transformer"


def current_version():
    try:
        return json.loads(POINTER.read_text(encoding="utf-8"))["version"]
    except Exception:
        return None


def versions():
    found = [p.name for p in MODELS_DIR.glob("v*") if (p / "bundle.joblib").exists() and p.name[1:].isdigit()]
    return sorted(found, key=lambda v: int(v[1:]))


def next_version():
    return f"v{max((int(v[1:]) for v in versions()), default=0) + 1}"


def save(bundle, metrics):
    d = MODELS_DIR / metrics["modelVersion"]
    d.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, d / "bundle.joblib")
    (d / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    tmp = POINTER.with_suffix(".tmp")
    tmp.write_text(json.dumps({"version": metrics["modelVersion"]}), encoding="utf-8")
    os.replace(tmp, POINTER)


def load(version):
    d = MODELS_DIR / version
    return joblib.load(d / "bundle.joblib"), json.loads((d / "metrics.json").read_text(encoding="utf-8"))
