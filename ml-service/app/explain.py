"""Explainability: leave-one-out occlusion. Each 1-3 word window is removed and the drop in SIF
probability is its weight. The best non-overlapping windows become highlightedPhrases, with character
offsets into the ORIGINAL text."""
import numpy as np

from .text import trim_span, word_spans


def occlusion(text, prob_fn, base_prob, max_words=80, top_k=4, min_drop=0.02):
    spans = word_spans(text)[:max_words]
    if not spans:
        return []
    windows, variants = [], []
    for size in (1, 2, 3):
        for i in range(len(spans) - size + 1):
            s, e = spans[i][0], spans[i + size - 1][1]
            windows.append((i, i + size - 1, s, e))
            variants.append(text[:s] + " " + text[e:])
    drops = base_prob - np.asarray(prob_fn(variants))
    # Prefer short, high-impact phrases.
    score = np.array([d / (1 + 0.25 * (w[1] - w[0])) for d, w in zip(drops, windows)])

    picked = []
    for k in np.argsort(score)[::-1]:
        if len(picked) >= top_k or score[k] <= 0:
            break
        if drops[k] < min_drop:
            continue
        i, j, s, e = windows[k]
        if any(i <= b and j >= a for a, b, *_ in picked):
            continue
        picked.append((i, j, s, e, float(drops[k])))

    out = []
    for _, _, s, e, d in sorted(picked, key=lambda x: x[2]):
        s, e = trim_span(text, s, e)
        if e > s:
            out.append({"text": text[s:e], "start": s, "end": e, "weight": round(d, 3)})
    return out
