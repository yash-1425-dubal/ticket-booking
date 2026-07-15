const Redis = require('ioredis');
const env = require('../config/env');

let connection = null;
let ready = false;
let readyResolve = null;
let readyPromise = new Promise((resolve) => { readyResolve = resolve; });

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
      if (readyResolve) readyResolve();
    }).catch(() => {
      console.warn('Queue Redis unavailable, background workers disabled');
      if (readyResolve) readyResolve();
    });
  } catch {
    console.warn('Queue Redis unavailable, background workers disabled');
    if (readyResolve) readyResolve();
  }
}

async function waitForReady(timeout = 5000) {
  await Promise.race([readyPromise, new Promise(r => setTimeout(r, timeout))]);
  return ready;
}

init();

module.exports = {
  get client() { return connection; },
  get isReady() { return ready; },
  waitForReady,
};
