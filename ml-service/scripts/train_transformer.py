"""Optional: fine-tune distilbert-base-uncased for SIF / NON_SIF with class-weighted loss (CPU is fine, ~5-15 min).
  pip install torch --index-url https://download.pytorch.org/whl/cpu
  pip install -r requirements-transformers.txt
  python scripts/train_transformer.py [--epochs 2]
Saves to models/transformer/. The service then serves a 0.6 DistilBERT + 0.4 TF-IDF ensemble."""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np  # noqa: E402
import torch  # noqa: E402
from sklearn.metrics import accuracy_score, precision_recall_fscore_support  # noqa: E402
from torch.utils.data import DataLoader, TensorDataset  # noqa: E402
from transformers import (AutoModelForSequenceClassification, AutoTokenizer,  # noqa: E402
                          get_linear_schedule_with_warmup)

from app import datagen, registry  # noqa: E402
from app.text import normalize  # noqa: E402
from app.training import load_rows  # noqa: E402

BASE_MODEL = "distilbert-base-uncased"


def encode(tok, rows, max_len):
    enc = tok([normalize(r["text"]) for r in rows], truncation=True, padding=True, max_length=max_len, return_tensors="pt")
    y = torch.tensor([1 if r["classification"] == "SIF" else 0 for r in rows])
    return enc, y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=2)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--lr", type=float, default=5e-5)
    args = ap.parse_args()
    torch.manual_seed(42)

    if not (registry.DATA_DIR / "train.csv").exists():
        datagen.generate(registry.DATA_DIR)
    train = load_rows(registry.DATA_DIR / "train.csv")
    val = load_rows(registry.DATA_DIR / "validation.csv")

    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=2)
    enc, y = encode(tok, train, args.max_len)
    pos = int(y.sum())
    weights = torch.tensor([len(y) / (2 * (len(y) - pos)), len(y) / (2 * pos)], dtype=torch.float)
    loss_fn = torch.nn.CrossEntropyLoss(weight=weights)  # handles the ~22% SIF imbalance

    dl = DataLoader(TensorDataset(enc["input_ids"], enc["attention_mask"], y), batch_size=args.batch, shuffle=True)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr)
    total = args.epochs * len(dl)
    sched = get_linear_schedule_with_warmup(opt, int(0.1 * total), total)

    model.train()
    t0, step = time.time(), 0
    for epoch in range(args.epochs):
        for ids, mask, labels in dl:
            loss = loss_fn(model(input_ids=ids, attention_mask=mask).logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            step += 1
            if step % 20 == 0:
                print(f"epoch {epoch + 1} step {step}/{total} loss {loss.item():.4f} ({time.time() - t0:.0f}s)")

    model.eval()
    venc, vy = encode(tok, val, args.max_len)
    with torch.no_grad():
        probs = torch.softmax(model(**venc).logits, dim=-1)[:, 1].numpy()
    pred = (probs >= 0.5).astype(int)
    prec, rec, f1, _ = precision_recall_fscore_support(vy.numpy(), pred, average="binary", zero_division=0)
    metrics = {"model": BASE_MODEL, "accuracy": round(float(accuracy_score(vy.numpy(), pred)), 4),
               "precision": round(float(prec), 4), "recall": round(float(rec), 4), "f1": round(float(f1), 4),
               "epochs": args.epochs, "trainingSamples": len(train), "trainSeconds": round(time.time() - t0)}

    out = registry.TRANSFORMER_DIR
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out)
    tok.save_pretrained(out)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(json.dumps(metrics, indent=2))
    print(f"saved to {out}; restart the service to use the DistilBERT ensemble")


if __name__ == "__main__":
    main()
