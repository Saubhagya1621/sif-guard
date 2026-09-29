"""Trains the fast tier (all heads share one feature space) and evaluates it on the held-out set."""
import csv
from datetime import datetime, timezone

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_recall_fscore_support
from sklearn.multiclass import OneVsRestClassifier
from sklearn.preprocessing import MultiLabelBinarizer

from .constants import BARRIERS, RULES
from .features import make_vectorizer
from .rules import KW_FLOOR, choose_barrier, keyword_scores

CORRECTION_WEIGHT = 3  # reviewer corrections count 3x (active learning)


def load_rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["rules"] = [x for x in (r.get("rules") or "").split("|") if x in RULES]
    return rows


def _lr(**kw):
    return LogisticRegression(C=4.0, max_iter=3000, **kw)


def _correction_rows(corrections):
    rows = []
    for c in corrections:
        if c.get("classification") not in ("SIF", "NON_SIF") or not c.get("text"):
            continue
        rows.append({
            "text": c["text"], "classification": c["classification"],
            "rules": [r for r in c.get("rules") or [] if r in RULES],
            "barrier_failure_type": c.get("barrierFailureType") if c.get("barrierFailureType") in BARRIERS else "none",
        })
    return rows


def train_bundle(train_rows, val_rows, corrections=(), version="v1"):
    corr = _correction_rows(corrections)
    all_rows = list(train_rows) + corr * CORRECTION_WEIGHT
    texts = [r["text"] for r in all_rows]

    vec = make_vectorizer()
    X = vec.fit_transform(texts)
    y = np.array([1 if r["classification"] == "SIF" else 0 for r in all_rows])

    clf = _lr(class_weight="balanced").fit(X, y)                     # SIF vs NON_SIF (imbalance-aware)
    n = len(train_rows)                                               # corrections carry no severity label
    sev = _lr(class_weight="balanced").fit(X[:n], [r["potential_severity"] for r in train_rows])
    barrier = _lr(class_weight="balanced").fit(X, [r["barrier_failure_type"] for r in all_rows])
    mlb = MultiLabelBinarizer(classes=RULES)
    rules_head = OneVsRestClassifier(_lr()).fit(X, mlb.fit_transform([r["rules"] for r in all_rows]))
    svd = TruncatedSVD(n_components=min(128, X.shape[1] - 1), random_state=42).fit(X)

    bundle = {"version": version, "vec": vec, "clf": clf, "sev": sev, "barrier": barrier,
              "mlb": mlb, "rules_head": rules_head, "svd": svd}
    metrics = evaluate(bundle, val_rows)
    metrics.update({
        "modelVersion": version,
        "lastTrainedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "trainingSamples": len(train_rows) + len(corr),
    })
    metrics["details"]["corrections"] = len(corr)
    return bundle, metrics


def evaluate(bundle, rows):
    """Held-out evaluation using the same decision logic as serving (except embedding similarity)."""
    texts = [r["text"] for r in rows]
    X = bundle["vec"].transform(texts)
    y = np.array([1 if r["classification"] == "SIF" else 0 for r in rows])
    pred = (bundle["clf"].predict_proba(X)[:, 1] >= 0.5).astype(int)
    prec, rec, f1, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)

    bar_p, bar_cls = bundle["barrier"].predict_proba(X), list(bundle["barrier"].classes_)
    bar_pred = [choose_barrier(bar_p[i], bar_cls, t, bool(pred[i])) for i, t in enumerate(texts)]

    head = bundle["rules_head"].predict_proba(X)
    classes = list(bundle["mlb"].classes_)
    pred_rules = []
    for i, t in enumerate(texts):
        kw = keyword_scores(t)
        scored = sorted(((max(0.7 * head[i, j] + 0.3 * kw[r], KW_FLOOR * kw[r]), r) for j, r in enumerate(classes)), reverse=True)
        pred_rules.append([r for s, r in scored[:3] if s >= 0.4])
    mlb = bundle["mlb"]
    rules_f1 = f1_score(mlb.transform([r["rules"] for r in rows]), mlb.transform(pred_rules), average="micro", zero_division=0)

    r4 = lambda v: round(float(v), 4)
    return {
        "accuracy": r4(accuracy_score(y, pred)), "precision": r4(prec), "recall": r4(rec), "f1": r4(f1),
        "details": {
            "validationSamples": len(rows),
            "severityAccuracy": r4(accuracy_score([r["potential_severity"] for r in rows], bundle["sev"].predict(X))),
            "barrierAccuracy": r4(accuracy_score([r["barrier_failure_type"] for r in rows], bar_pred)),
            "rulesMicroF1": r4(rules_f1),
        },
    }
