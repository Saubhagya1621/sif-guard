"""Entity extraction (activity, location, equipment) with spaCy PhraseMatcher rules + regex for site codes.
Works without spaCy (plain substring fallback)."""
import logging
import re

log = logging.getLogger("sifguard.ml")

ACTIVITY_PHRASES = {
    "Pump maintenance": ["pump casing", "impeller", "seal", "coupling", "gland", "pump maintenance"],
    "Crane lift": ["crane", "sling", "slings", "rigger", "suspended load", "lift plan", "tagline", "shackle"],
    "Hot work": ["welding", "grinding", "gas cutting", "hot work", "fire watch"],
    "Confined space entry": ["confined space", "manhole", "sludge tank", "knockout drum", "entered the", "entry into"],
    "Work at height": ["monkey board", "scaffold", "harness", "ladder", "tank roof", "derrick"],
    "Vehicle movement": ["tanker", "pickup", "driver", "driving", "vehicle", "reversed", "overspeeding", "crew bus"],
    "Process operation": ["interlock", "trip", "inhibited", "emergency shutdown", "override", "jumpered"],
    "Well testing": ["hose", "union", "choke manifold", "flowline", "wellhead", "pressure test", "test separator"],
    "Electrical work": ["mcc panel", "distribution board", "electrical work", "breaker", "lighting panel"],
    "Excavation": ["excavation", "trench"],
    "Housekeeping": ["housekeeping", "oily rags", "dustbin"],
}
EQUIPMENT = ["pump", "motor", "crane", "sling", "compressor", "separator", "tank", "hose", "tanker", "pickup", "truck",
             "scaffold", "ladder", "valve", "generator", "drill pipe", "casing", "bop stack", "monkey board", "harness",
             "gas detector", "heater treater", "flowline", "wellhead", "mcc panel", "choke manifold"]
LOCATION_PHRASES = ["tank farm", "pump house", "compressor station", "workshop", "control room", "field road",
                    "mud tank area", "store yard", "canteen", "camp", "well pad", "catwalk"]
CODE_RX = re.compile(r"\b(?:GGS|OCS|EPS|CTF|QPS)[- ]?\d+\b|\bwell ?pad[- ]?\d+\b|\brig [A-Z]{2,4}-?\d+\b", re.I)

_nlp = _matcher = None
try:
    import spacy
    from spacy.matcher import PhraseMatcher

    _nlp = spacy.blank("en")
    _matcher = PhraseMatcher(_nlp.vocab, attr="LOWER")
    for act, phrases in ACTIVITY_PHRASES.items():
        _matcher.add(f"ACT::{act}", [_nlp.make_doc(p) for p in phrases])
    _matcher.add("EQUIPMENT", [_nlp.make_doc(p) for p in EQUIPMENT])
    _matcher.add("LOCATION", [_nlp.make_doc(p) for p in LOCATION_PHRASES])
except Exception as e:  # spaCy missing: substring fallback
    log.warning("spaCy unavailable (%s); using substring entity matching", type(e).__name__)


def _pretty(loc: str) -> str:
    return loc if any(c.isupper() for c in loc) else loc.title()


def extract_entities(text: str) -> dict:
    activity = equipment = location = ""
    m = CODE_RX.search(text)
    if m:
        location = m.group(0)
    if _nlp is not None:
        doc = _nlp(text)
        for match_id, start, end in sorted(_matcher(doc), key=lambda x: x[1]):
            key = _nlp.vocab.strings[match_id]
            span = doc[start:end].text
            if key.startswith("ACT::") and not activity:
                activity = key[5:]
            elif key == "EQUIPMENT" and not equipment:
                equipment = span.lower()
            elif key == "LOCATION" and not location:
                location = span
    else:
        low = text.lower()
        activity = next((a for a, ps in ACTIVITY_PHRASES.items() if any(p in low for p in ps)), "")
        equipment = next((e for e in EQUIPMENT if e in low), "")
        location = location or next((p for p in LOCATION_PHRASES if p in low), "")
    return {"activity": activity or "General operations", "location": _pretty(location) if location else "",
            "equipment": equipment}
