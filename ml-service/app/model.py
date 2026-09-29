"""Predictor: loads the active model once, serves classify / tag-rules / cluster, hot-swaps after retrain."""
import json
import logging
import os
import threading
from collections import Counter
from types import SimpleNamespace

import numpy as np
from sklearn.cluster import HDBSCAN

from . import datagen, registry
from .constants import BARRIER_LABELS, BARRIERS, RULE_LABELS, RULES
from .embeddings import Embedder
from .entities import extract_entities
from .explain import occlusion
from .rules import RuleTagger, choose_barrier
from .training import load_rows, train_bundle
from .transformer import TransformerClassifier
from .translate import detect_language, to_english

log = logging.getLogger("sifguard.ml")
CORRECTIONS_FILE = registry.DATA_DIR / "corrections.jsonl"


def _mode(values):
    vals = [v for v in values if v]
    return Counter(vals).most_common(1)[0][0] if vals else None


class Predictor:
    def __init__(self):
        self.lock = threading.RLock()          # guards model swap
        self.retrain_lock = threading.Lock()   # one retrain at a time
        self.embedder = None
        bundle, metrics = self._load_or_train()
        self._activate(bundle, metrics)
        self.transformer = (TransformerClassifier.load(registry.TRANSFORMER_DIR)
                            if os.getenv("USE_TRANSFORMER", "1") == "1" else None)

    # ── model lifecycle ──
    def _corrections(self):
        if not CORRECTIONS_FILE.exists():
            return []
        with open(CORRECTIONS_FILE, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def _data(self):
        train = registry.DATA_DIR / "train.csv"
        if not train.exists():
            log.info("Generating synthetic dataset: %s", datagen.generate(registry.DATA_DIR))
        return load_rows(train), load_rows(registry.DATA_DIR / "validation.csv")

    def _load_or_train(self):
        candidates = [registry.current_version(), *reversed(registry.versions())]
        for v in dict.fromkeys(c for c in candidates if c):
            try:
                bundle, metrics = registry.load(v)
                log.info("Loaded model %s", v)
                return bundle, metrics
            except Exception as e:  # corrupt version: fall back to an older one
                log.warning("Could not load model %s: %s", v, e)
        log.info("No trained model found; training on first run")
        train, val = self._data()
        bundle, metrics = train_bundle(train, val, self._corrections(), registry.next_version())
        registry.save(bundle, metrics)
        return bundle, metrics

    def _activate(self, bundle, metrics):
        with self.lock:
            self.bundle, self.metrics = bundle, metrics
            if self.embedder is None:
                self.embedder = Embedder(bundle)
            else:
                self.embedder.set_bundle(bundle)
            self.tagger = RuleTagger(bundle, self.embedder)

    @property
    def model_version(self):
        v = self.metrics["modelVersion"]
        return f"{v}+distilbert" if self.transformer else v

    def warmup(self):
        self.classify([SimpleNamespace(id="warmup", text="Fitter opened the pump without lockout.", language="en")])
        log.info("Warm-up done (model %s, embeddings %s)", self.model_version, self.embedder.name)

    # ── inference ──
    def classify(self, reports):
        with self.lock:
            b = self.bundle
        langs = [detect_language(r.text) for r in reports]
        eng = [to_english(r.text, lang) for r, lang in zip(reports, langs)]
        X = b["vec"].transform(eng)
        p_fast = b["clf"].predict_proba(X)[:, 1]
        p_bert = self.transformer.predict_proba(eng) if self.transformer else None
        p = p_fast if p_bert is None else 0.6 * p_bert + 0.4 * p_fast
        sev_p, sev_cls = b["sev"].predict_proba(X), list(b["sev"].classes_)
        bar_p, bar_cls = b["barrier"].predict_proba(X), list(b["barrier"].classes_)
        fast = lambda texts: b["clf"].predict_proba(b["vec"].transform(texts))[:, 1]

        out = []
        for i, r in enumerate(reports):
            prob = float(p[i])
            sif = prob >= 0.5
            conf = 0.5 + abs(prob - 0.5)
            if p_bert is not None:  # the two models disagreeing lowers confidence
                conf -= 0.3 * abs(float(p_bert[i]) - float(p_fast[i]))
            sev = sev_cls[int(np.argmax(sev_p[i]))]
            if sif and sev == "minor":
                sev = "serious"
            if not sif and sev == "fatal":
                sev = "serious"
            barrier = choose_barrier(bar_p[i], bar_cls, eng[i], sif)  # head + keyword cues
            out.append({
                "id": r.id,
                "classification": "SIF" if sif else "NON_SIF",
                "sifProbability": round(prob, 3),
                "confidence": round(float(np.clip(conf, 0, 1)), 3),
                "highlightedPhrases": occlusion(r.text, fast, float(p_fast[i])) if langs[i] == "en" else [],
                "potentialSeverity": sev,
                "barrierFailureType": barrier,
                "entities": extract_entities(eng[i]),
            })
        return out

    def tag_rules(self, reports):
        with self.lock:
            b, tagger = self.bundle, self.tagger
        eng = [to_english(r.text, detect_language(r.text)) for r in reports]
        return tagger.tag(eng, b["vec"].transform(eng))

    def cluster(self, reports):
        n = len(reports)
        if n < 5:
            return []
        eng = [to_english(r.text or r.activity or "", detect_language(r.text or "")) or "report" for r in reports]
        E = self.embedder.embed(eng)
        bidx = {b: i for i, b in enumerate(BARRIERS)}
        ridx = {r: i for i, r in enumerate(RULES)}
        B = np.zeros((n, len(BARRIERS)))
        R = np.zeros((n, len(RULES) + 1))
        for i, r in enumerate(reports):
            B[i, bidx.get(r.barrierFailureType or "none", bidx["none"])] = 1
            first = next((x for x in r.rules if x in ridx), None)
            R[i, ridx[first] if first else len(RULES)] = 1
        features = np.hstack([E, 0.6 * B, 0.6 * R])  # steer clusters toward barrier + rule combinations
        try:
            labels = HDBSCAN(min_cluster_size=3, min_samples=2, copy=True).fit_predict(features)
        except Exception as e:
            log.warning("HDBSCAN failed (%s); using key grouping", e)
            labels = np.full(n, -1)

        groups = {}
        for i, lab in enumerate(labels):
            if lab >= 0:
                groups.setdefault(int(lab), []).append(i)
        if not groups:  # tiny or very diverse input: group by activity + barrier + rule
            for i, r in enumerate(reports):
                first = next((x for x in r.rules if x in ridx), None)
                if first:
                    groups.setdefault(f"{r.activity}|{r.barrierFailureType}|{first}", []).append(i)
            groups = {k: v for k, v in groups.items() if len(v) >= 2}

        clusters = []
        for idxs in sorted(groups.values(), key=len, reverse=True):
            members = [reports[i] for i in idxs]
            activity = _mode([m.activity for m in members]) or "General operations"
            barrier = _mode([m.barrierFailureType for m in members if m.barrierFailureType != "none"]) or "none"
            rule = _mode([x for m in members for x in m.rules if x in ridx])
            if barrier != "none":
                label = f"{BARRIER_LABELS[barrier]} failure during {activity.lower()}"
            elif rule:
                label = f"{RULE_LABELS[rule]} precursors in {activity.lower()}"
            else:
                label = f"Recurring issues in {activity.lower()}"
            clusters.append({
                "id": f"C{len(clusters) + 1}", "label": label, "activity": activity,
                "location": _mode([m.location for m in members]) or "", "barrierFailureType": barrier,
                "rule": rule, "count": len(members),
                "siteIds": sorted({m.siteId for m in members if m.siteId}),
                "reportIds": [m.id for m in members],
            })
        return clusters

    # ── active learning ──
    def retrain(self, corrections):
        with self.retrain_lock:
            if corrections:
                CORRECTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
                with open(CORRECTIONS_FILE, "a", encoding="utf-8") as f:
                    for c in corrections:
                        f.write(json.dumps(c, ensure_ascii=False) + "\n")
            version = registry.next_version()
            try:
                train, val = self._data()
                bundle, metrics = train_bundle(train, val, self._corrections(), version)
                registry.save(bundle, metrics)
                self._activate(bundle, metrics)
            except Exception:
                log.exception("Retrain failed; keeping %s", self.metrics["modelVersion"])
                return {"status": "failed", "trainedOn": len(corrections), "modelVersion": self.metrics["modelVersion"],
                        "metrics": {"accuracy": self.metrics["accuracy"], "f1": self.metrics["f1"]}}
            log.info("Retrained %s on %d new corrections", version, len(corrections))
            return {"status": "completed", "trainedOn": len(corrections), "modelVersion": version,
                    "metrics": {"accuracy": metrics["accuracy"], "f1": metrics["f1"]}}

    def metrics_payload(self):
        m = self.metrics
        return {
            "modelVersion": self.model_version, "accuracy": m["accuracy"], "precision": m["precision"],
            "recall": m["recall"], "f1": m["f1"], "lastTrainedAt": m["lastTrainedAt"],
            "trainingSamples": m["trainingSamples"], "details": m.get("details", {}),
            "embeddings": self.embedder.name, "classifier": "distilbert+tfidf" if self.transformer else "tfidf-logreg",
        }
