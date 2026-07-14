const { randomUUID } = require('crypto');
const redis = require('../config/redis');

/** In-memory lock fallback used when Redis is unavailable. */
const memoryLocks = new Map();

/**
 * Remove all expired entries from the in-memory lock map.
 * Called lazily inside acquireLock before checking any specific key.
 */
function purgeExpiredMemoryLocks() {
  const now = Date.now();
  for (const [key, entry] of memoryLocks) {
    if (entry.expiresAt <= now) {
      memoryLocks.delete(key);
    }
  }
}

async function acquireLock(key, ttlMs) {
  if (!redis.isAvailable) {
    purgeExpiredMemoryLocks();
    const existing = memoryLocks.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return null;
    }
    const token = randomUUID();
    memoryLocks.set(key, { token, expiresAt: Date.now() + ttlMs });
    return token;
  }

  const token = randomUUID();
  const result = await redis.set(key, token, 'NX', 'PX', ttlMs);
  if (result !== 'OK') return null;
  return token;
}

async function releaseLock(key, token) {
  // Handle in-memory lock release — works regardless of Redis availability.
  const memoryEntry = memoryLocks.get(key);
  if (memoryEntry && memoryEntry.token === token) {
    memoryLocks.delete(key);
    return;
  }

  // Legacy: a 'noop-lock' token from before this fallback existed.
  if (token === 'noop-lock') {
    memoryLocks.delete(key);
    return;
  }

  if (!redis.isAvailable) return;

  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0
  `;
  return redis.eval(script, 1, key, token);
}

async function withRedisLock(key, ttlMs, callback) {
  const token = await acquireLock(key, ttlMs);
  if (!token) return null;
  try {
    return await callback();
  } finally {
    await releaseLock(key, token);
  }
}

module.exports = { acquireLock, releaseLock, withRedisLock };
