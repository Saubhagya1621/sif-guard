"""Feature space: TF-IDF (word + char n-grams) plus SIF-methodology precursor features.

DEKRA/EEI principle: SIF potential = a high-energy source + a missing/failed control, whatever the outcome.
The precursor features encode that concept directly, so the model generalises to phrasings it never saw."""
import re

import numpy as np
from scipy import sparse
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion

from .text import normalize

# High-energy sources: things that can seriously injure or kill.
HAZARD_RX = re.compile(
    r"\b(?:live|energi[sz]ed|motor|breaker|mcc|electrical|panel|suspended load|lift\w*|crane|slings?|shackle|"
    r"rigging|height|monkey board|derrick|scaffold\w*|roof|ladder|edge|fall|weld\w*|grind\w*|gas cutting|cutting|"
    r"hot work|sparks?|hydrocarbon|flammable|h2s|gas|vessel|tank|drum|pit|confined|manhole|pressur\w*|hose|union|"
    r"flowline|wellhead|relief valve|interlock|emergency shutdown|detector|vehicle|tanker|truck|pickup|trailer|bus|"
    r"driv\w*|revers\w*|overspeed\w*|pipe|rack|dropped|rolled|pinned|swung|excavation|pipeline)\b")

# Missing, failed, bypassed or defeated controls, or a person inside the danger zone.
FAILURE_RX = re.compile(
    r"\b(?:without|no|not|never|missing|absent|expired|cancell?ed|bypass\w*|inhibit\w*|jumper\w*|overrid\w*|"
    r"disabled|switched off|(?:found|observed|noticed) closed|frayed|damaged|defective|faulty|broken|untrained|"
    r"alone|unauthori[sz]ed|still|before|slipped|dropped|rolled off|whipped|nearly|almost|narrowly|missed|"
    r"mobile phone|under (?:the |a )?suspended load|in front of|line of fire)\b")

# Evidence the control held, or nobody was exposed.
MITIGATION_RX = re.compile(
    r"\b(?:safely|in place|in good condition|accounted for|as per (?:procedure|schedule|plan)|verified|barricaded|"
    r"remained stable|depressuri[sz]ed|unused|idle|removed from service|not in use|in progress|found working|"
    r"designated area|replaced|refilled|displayed|reviewed|completed|job (?:was |already |is )?closed)\b")

# Low-energy / minor-outcome wording.
MINOR_RX = re.compile(
    r"\b(?:first aid|no injury|minor|bruise|scratch|headache|housekeeping|slipped on|wet floor|dustbin|signage|"
    r"notice board|water cooler|carton|drawer)\b")


class PrecursorFeatures(BaseEstimator, TransformerMixin):
    """[hazard, failure, hazard AND failure, hazard AND failure AND no mitigation, mitigation, minor]"""

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        rows = []
        for text in X:
            t = normalize(text)
            h = len(HAZARD_RX.findall(t))
            f = len(FAILURE_RX.findall(t))
            m = len(MITIGATION_RX.findall(t))
            o = len(MINOR_RX.findall(t))
            both = float(h > 0 and f > 0)
            rows.append([min(h, 3) / 3, min(f, 3) / 3, both, both * float(m == 0), min(m, 2) / 2, min(o, 2) / 2])
        return sparse.csr_matrix(np.asarray(rows, dtype=float))


def make_vectorizer() -> FeatureUnion:
    """Word 1-2 grams + char 3-5 grams (robust to typos) + precursor features (robust to new phrasings)."""
    return FeatureUnion([
        ("word", TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=2, sublinear_tf=True)),
        ("char", TfidfVectorizer(preprocessor=normalize, analyzer="char_wb", ngram_range=(3, 5),
                                 min_df=3, sublinear_tf=True, max_features=50000)),
        ("precursor", PrecursorFeatures()),
    ], transformer_weights={"word": 1.0, "char": 1.0, "precursor": 2.0})
