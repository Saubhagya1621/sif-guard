// Tiny in-memory cache for /dashboard/patterns (ML clustering is slow). Cleared on upload/review.
const TTL_MS = 10 * 60 * 1000;
const store = new Map();

module.exports = {
  get(key) {
    const e = store.get(key);
    return e ? { value: e.value, fresh: Date.now() - e.at < TTL_MS } : undefined;
  },
  set(key, value) { store.set(key, { value, at: Date.now() }); },
  clear() { store.clear(); },
};
