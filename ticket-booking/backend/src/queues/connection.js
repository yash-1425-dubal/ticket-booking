const Redis = require('ioredis');
const env = require('../config/env');

let connection = null;
let ready = false;

function init() {
  try {
    const conn = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 2) return null;
        return 100;
      },
      lazyConnect: true,
    });

    conn.on('error', () => {}); // silence errors

    conn.connect().then(() => {
      ready = true;
      connection = conn;
    }).catch(() => {
      console.warn('Queue Redis unavailable, background workers disabled');
    });
  } catch {
    console.warn('Queue Redis unavailable, background workers disabled');
  }
}

init();

module.exports = {
  get client() { return connection; },
  get isReady() { return ready; },
};
