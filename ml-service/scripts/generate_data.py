"""python scripts/generate_data.py  → data/train.csv (~1600 rows, 22% SIF) + data/validation.csv (held-out templates)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import datagen, registry  # noqa: E402

if __name__ == "__main__":
    print(datagen.generate(registry.DATA_DIR))
