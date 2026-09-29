"""Sentence embeddings for clustering and rule similarity.
Uses MiniLM (sentence-transformers) when installed, otherwise LSA (TF-IDF + SVD) from the trained bundle."""
import logging
import os

from sklearn.preprocessing import normalize as l2

log = logging.getLogger("sifguard.ml")


class Embedder:
    def __init__(self, bundle):
        self.st = None
        if os.getenv("USE_SENTENCE_TRANSFORMERS", "1") == "1":
            try:
                from sentence_transformers import SentenceTransformer
                name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
                self.st = SentenceTransformer(name, device="cpu")
                log.info("Embeddings: %s", name)
            except Exception as e:  # not installed or offline
                log.info("Embeddings: LSA fallback (%s)", type(e).__name__)
        self.set_bundle(bundle)

    @property
    def name(self):
        return "minilm" if self.st else "lsa"

    def set_bundle(self, bundle):
        self.vec, self.svd = bundle["vec"], bundle["svd"]

    def embed(self, texts):
        if self.st is not None:
            E = self.st.encode(list(texts), batch_size=32, normalize_embeddings=True, show_progress_bar=False)
        else:
            E = self.svd.transform(self.vec.transform(list(texts)))
        return l2(E)
