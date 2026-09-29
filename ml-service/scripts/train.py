"""python scripts/train.py  → trains the fast tier into models/vN and makes it current."""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import datagen, registry  # noqa: E402
from app.training import load_rows, train_bundle  # noqa: E402

if __name__ == "__main__":
    if not (registry.DATA_DIR / "train.csv").exists():
        print("dataset:", datagen.generate(registry.DATA_DIR))
    t0 = time.time()
    bundle, metrics = train_bundle(load_rows(registry.DATA_DIR / "train.csv"),
                                   load_rows(registry.DATA_DIR / "validation.csv"),
                                   version=registry.next_version())
    registry.save(bundle, metrics)
    print(json.dumps(metrics, indent=2))
    print(f"trained {metrics['modelVersion']} in {time.time() - t0:.1f}s")
