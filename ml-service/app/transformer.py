"""Optional fine-tuned DistilBERT (trained by scripts/train_transformer.py). Loaded only if present."""
import logging

import numpy as np

from .text import normalize

log = logging.getLogger("sifguard.ml")


class TransformerClassifier:
    def __init__(self, tokenizer, model, torch):
        self.tok, self.model, self.torch = tokenizer, model, torch

    @classmethod
    def load(cls, path):
        if not (path / "config.json").exists():
            return None
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
        except ImportError:
            log.warning("DistilBERT model found but torch/transformers are not installed; using fast tier only")
            return None
        tok = AutoTokenizer.from_pretrained(path)
        model = AutoModelForSequenceClassification.from_pretrained(path)
        model.eval()
        log.info("Classifier: DistilBERT ensemble loaded from %s", path)
        return cls(tok, model, torch)

    def predict_proba(self, texts):
        out = []
        with self.torch.no_grad():
            for i in range(0, len(texts), 32):
                enc = self.tok([normalize(t) for t in texts[i:i + 32]], truncation=True, padding=True,
                               max_length=128, return_tensors="pt")
                logits = self.model(**enc).logits
                out.append(self.torch.softmax(logits, dim=-1)[:, 1].numpy())
        return np.concatenate(out) if out else np.array([])
