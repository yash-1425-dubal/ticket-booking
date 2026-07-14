const Redis = require('ioredis');
const env = require('./env');

let client;
let isAvailable = false;

function noop() { return Promise.resolve(null); }

try {
  client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 100, 1000);
    },
    lazyConnect: true,
  });

  client.on('error', () => {}); // silence connection errors

  client.connect().then(() => {
    isAvailable = true;
    console.log('Redis connected');
  }).catch((err) => {
    console.warn('Redis unavailable, running without caching/locking:', err.message);
  });
} catch (err) {
  console.warn('Redis init failed:', err.message);
  client = null;
}

const redis = {
  get client() { return client; },
  get isAvailable() { return isAvailable; },
  // Proxy common redis operations to the client, noop if unavailable
  get: (...args) => client ? client.get(...args) : noop(),
  set: (...args) => client ? client.set(...args) : noop(),
  del: (...args) => client ? client.del(...args) : noop(),
  incr: (...args) => client ? client.incr(...args) : noop(),
  expire: (...args) => client ? client.expire(...args) : noop(),
  pexpire: (...args) => client ? client.pexpire(...args) : noop(),
  eval: (...args) => client ? client.eval(...args) : noop(),
};

module.exports = redis;