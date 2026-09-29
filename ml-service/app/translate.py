"""Stretch (Phase 8): Hindi/Assamese support.
Script-based language detection + a safety-term glossary that maps field vocabulary to English before
classification. This is a starter, not full machine translation. Swap in IndicTrans2 for production and have
native speakers review the glossary. Highlight offsets are not computed for non-English text (contract allows [])."""
import re

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
BENGALI_ASSAMESE = re.compile(r"[\u0980-\u09FF]")

HINDI = {
    "लॉकआउट": "lockout", "लॉक आउट": "lockout", "आइसोलेशन": "isolation", "बिना": "without", "नहीं": "not",
    "परमिट": "permit", "अनुमति": "permit", "हार्नेस": "harness", "ऊंचाई": "height", "ऊँचाई": "height",
    "क्रेन": "crane", "लटकते भार": "suspended load", "लटकता भार": "suspended load", "भार": "load",
    "वेल्डिंग": "welding", "गैस परीक्षण": "gas test", "गैस टेस्ट": "gas test", "गैस": "gas", "मोटर": "motor",
    "पंप": "pump", "चालू": "energised running", "मरम्मत": "repair maintenance", "टैंक": "tank", "वाहन": "vehicle",
    "ड्राइवर": "driver", "तेज गति": "overspeeding", "तेज़ गति": "overspeeding", "फिसल": "slipped",
    "चोट नहीं": "no injury", "दस्ताने": "gloves", "हेलमेट": "helmet", "मचान": "scaffold", "सीढ़ी": "ladder",
    "बाईपास": "bypass", "इंटरलॉक": "interlock", "दबाव": "pressure", "होज़": "hose", "पाइप": "pipe",
    "कर्मचारी": "worker", "मजदूर": "worker", "पर्यवेक्षक": "supervisor", "प्रशिक्षण": "training", "आग": "fire",
    "रिसाव": "leak", "सफाई": "housekeeping cleaning",
}
ASSAMESE = {
    "লকআউট": "lockout", "অবিহনে": "without", "নোহোৱাকৈ": "without", "নাই": "not", "পাৰমিট": "permit",
    "হাৰ্নেছ": "harness", "ওখ": "height", "ক্ৰেন": "crane", "ওলমি থকা বোজা": "suspended load", "বোজা": "load",
    "ৱেল্ডিং": "welding", "গেছ পৰীক্ষা": "gas test", "গেছ": "gas", "মটৰ": "motor", "পাম্প": "pump",
    "চলি আছিল": "energised running", "মেৰামতি": "repair maintenance", "টেংক": "tank", "গাড়ী": "vehicle",
    "চালক": "driver", "বাইপাছ": "bypass", "চাপ": "pressure", "কৰ্মী": "worker", "তদাৰক": "supervisor",
    "প্ৰশিক্ষণ": "training", "জুই": "fire", "লিক": "leak", "পিছল": "slipped", "আঘাত নাই": "no injury",
}


def detect_language(text: str) -> str:
    if DEVANAGARI.search(text):
        return "hi"
    if BENGALI_ASSAMESE.search(text):
        return "as"
    return "en"


def to_english(text: str, lang: str) -> str:
    if lang == "en":
        return text
    gloss = HINDI if lang == "hi" else ASSAMESE
    t = text
    for term in sorted(gloss, key=len, reverse=True):
        t = t.replace(term, f" {gloss[term]} ")
    t = re.sub(r"[^\x00-\x7F]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t or text
