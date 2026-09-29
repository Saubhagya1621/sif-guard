"""Text normalisation shared by training and inference (must stay identical for both)."""
import re

_ABBREVIATIONS = [
    (re.compile(r"\bw/o\b"), "without"),
    (re.compile(r"\bloto\b"), "lockout tagout"),
    (re.compile(r"\bptw\b"), "permit to work"),
    (re.compile(r"\bsupvr\b"), "supervisor"),
    (re.compile(r"\boptr\b"), "operator"),
    (re.compile(r"\besd\b"), "emergency shutdown"),
]
_WORD = re.compile(r"\S+")
_PUNCT = ".,;:!?\"'()[]"


def normalize(text: str) -> str:
    t = text.lower()
    for rx, rep in _ABBREVIATIONS:
        t = rx.sub(rep, t)
    return t


def word_spans(text: str):
    return [(m.start(), m.end()) for m in _WORD.finditer(text)]


def trim_span(text: str, start: int, end: int):
    while start < end and text[start] in _PUNCT:
        start += 1
    while end > start and text[end - 1] in _PUNCT:
        end -= 1
    return start, end
