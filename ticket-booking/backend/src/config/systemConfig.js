const env = require('./env');

let cache = {};

function invalidateCache() {
  cache = {};
}

async function getConfig(key) {
  // Check env first
  const envKey = key;
  if (env[envKey]) return env[envKey];

  // Check in-memory cache
  if (cache[key]) return cache[key];

  // Check DB
  try {
    const prisma = require('../config/prisma');
    const entry = await prisma.systemConfig.findUnique({ where: { key } });
    if (entry) {
      cache[key] = entry.value;
      return entry.value;
    }
  } catch {}

  return '';
}

module.exports = { getConfig, invalidateCache };
