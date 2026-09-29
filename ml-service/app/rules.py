"""IOGP Life-Saving Rule tagging: blend of (a) trained multi-label head, (b) keyword/regex rules,
(c) embedding similarity to rule descriptions. A clear keyword match alone is enough to tag.
Returns rules with confidence >= 0.4, max 3. Also: barrier-failure keyword cues."""
import re

import numpy as np

from .constants import RULE_DESCRIPTIONS, RULES
from .text import normalize

RULE_PATTERNS = {
    "energy_isolation": r"\block ?out\b|\blockout tagout\b|\bisolat\w*|\benergi[sz]ed\b|\bstill live\b|\bzero energy\b|\bbleed\w*|\bdepressuri\w*|\bbreaker\b|\bnot purged\b",
    "hot_work": r"\bweld\w*|\bgrind\w*|\bgas cutting\b|\bhot work\b|\bsparks?\b|\bfire watch\b",
    "confined_space": r"\bconfined\b|\bmanhole\b|\batmospheric test\w*|\bstandby man\b|\b(?:entered|inside|entry into)\b.{0,30}\b(?:vessel|tank|drum|pit)\b",
    "working_at_height": r"\bharness\b|\bscaffold\w*|\bladder\b|\bmonkey board\b|\bderrick\b|\bat height\b|\bfall protection\b|\bguardrail\b|\btank roof\b|\bpipe rack\b",
    "safe_mechanical_lifting": r"\bcrane\b|\bslings?\b|\brigg\w*|\bsuspended load\b|\bhoist\w*|\bshackle\b|\btagline\b|\blift(?:ing|ed| plan)?\b",
    "line_of_fire": r"\bline of fire\b|\bwhip\w*|\bpinned\b|\bstruck\b|\bdropped\b|\bswung\b|\bin front of\b|\bunder pressure\b|\bpressuri[sz]ed\b|\bexclusion zone\b|\brolled off\b",
    "driving": r"\bdriv\w*|\bvehicle\b|\btanker\b|\bpickup\b|\btruck\b|\bbus\b|\boverspeed\w*|\bseat ?belt\b|\brevers\w*|\bbanksman\b|\bjourney\b|\bheadlights?\b",
    "work_authorisation": r"\bpermit\w*|\bpermit to work\b|\bauthori[sz]\w*",
    "bypassing_safety_controls": r"\bbypass\w*|\binterlock\b|\binhibit\w*|\bjumper\w*|\boverride\b|\bemergency shutdown\b|\btrip (?:interlock|switch|system)\b|\brelief valve\b",
}
_COMPILED = {rule: re.compile(p) for rule, p in RULE_PATTERNS.items()}

BARRIER_PATTERNS = {
    "isolation": r"\block ?out|lockout tagout|\bisolat\w*|\bstill live\b|\benergi[sz]ed\b|\bnot purged\b|\bwithout bleeding\b|\b(?:found|observed|noticed) closed\b|\bbreaker\b",
    "ppe": r"\bharness\b|\bgoggles?\b|\bgloves?\b|\bhelmet\b|\bgas detector\b|\bfall protection\b|\bppe\b|\brespirator\b",
    "procedure": r"\bpermit\w*|\bprocedure\b|\bbypass\w*|\binhibit\w*|\bgas test\b|\boverspeed\w*|\bmobile phone\b|\bjumper\w*|\bnot updated\b|\bnot signed\b",
    "supervision": r"\bstandby\b|\bbanksman\b|\bfire watch\b|\bsupervis\w*|\bunder (?:the |a )?suspended load\b|\bin front of\b|\backnowledged late\b|\bcrew still\b",
    "equipment": r"\bfrayed\b|\bdamaged\b|\bdefective\b|\bfaulty\b|\bbroken\b|\bcorroded\b|\bleak\w*|\bnot working\b|\bguardrail\b|\bslipped from\b|\brolled off\b|\bheadlights?\b|\btorn\b",
    "training": r"\buntrained\b|\bnot trained\b|\btrainee\b|\bnew joinee\b|\btraining\b|\binduction\b",
}
_BARRIER_RX = {b: re.compile(p) for b, p in BARRIER_PATTERNS.items()}

KW_FLOOR = 0.8  # a single clear keyword match (score 0.5) → 0.4, which passes the threshold


def keyword_scores(text: str) -> dict:
    t = normalize(text)
    scores = {}
    for rule, rx in _COMPILED.items():
        hits = len(set(m.group(0) for m in rx.finditer(t)))
        scores[rule] = min(1.0, 0.5 + 0.2 * (hits - 1)) if hits else 0.0
    return scores


def barrier_cues(text: str) -> dict:
    t = normalize(text)
    return {b: bool(rx.search(t)) for b, rx in _BARRIER_RX.items()}


def choose_barrier(proba, classes, text, sif):
    """Barrier head + keyword cues. A SIF precursor implies some barrier failed, so 'none' is excluded for SIF."""
    scores = {c: float(p) for c, p in zip(classes, proba)}
    if sif:
        for b, hit in barrier_cues(text).items():
            if hit and b in scores:
                scores[b] += 0.5
        if "none" in scores and len(scores) > 1:
            scores["none"] = -1.0
    return max(scores, key=scores.get)


class RuleTagger:
    W_HEAD, W_KEYWORD, W_SIM = 0.55, 0.30, 0.15

    def __init__(self, bundle, embedder):
        self.head = bundle["rules_head"]
        self.classes = list(bundle["mlb"].classes_)
        self.embedder = embedder
        self.R = embedder.embed([RULE_DESCRIPTIONS[r] for r in self.classes])

    def tag(self, texts, X):
        head = self.head.predict_proba(X)
        S = self.embedder.embed(texts) @ self.R.T
        out = []
        for i, text in enumerate(texts):
            kw = keyword_scores(text)
            items = []
            for j, rule in enumerate(self.classes):
                sim = float(np.clip((S[i, j] - 0.15) / 0.45, 0, 1))
                blend = self.W_HEAD * float(head[i, j]) + self.W_KEYWORD * kw[rule] + self.W_SIM * sim
                conf = max(blend, KW_FLOOR * kw[rule])
                if conf >= 0.4:
                    items.append({"rule": rule, "confidence": round(conf, 3)})
            items.sort(key=lambda r: -r["confidence"])
            out.append(items[:3])
        return out


assert set(RULE_PATTERNS) == set(RULES)
