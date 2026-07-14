class MemoryCache {
  constructor(ttlMs = 10 * 60 * 1000) {
    this._cache = new Map();
    this._ttl = ttlMs;
    // Clean expired entries every 5 minutes
    this._timer = setInterval(() => this._evict(), 5 * 60 * 1000);
    if (this._timer.unref) this._timer.unref();
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this._ttl),
    });
  }

  _evict() {
    const now = Date.now();
    for (const [key, entry] of this._cache) {
      if (now > entry.expiresAt) this._cache.delete(key);
    }
  }

  stop() {
    clearInterval(this._timer);
    this._cache.clear();
  }
}

module.exports = MemoryCache;
