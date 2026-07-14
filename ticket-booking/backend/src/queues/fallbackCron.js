const { releaseExpiredHolds } = require('../modules/seats/seat.service');

const INTERVAL_MS = 30000;
let intervalHandle = null;

function startFallbackCron() {
  if (intervalHandle) return intervalHandle;
  console.log('[FallbackCron] Starting seat hold cleanup (every 30s)');
  intervalHandle = setInterval(async () => {
    try {
      const released = await releaseExpiredHolds();
      if (released > 0) {
        console.log(`[FallbackCron] Released ${released} expired seat holds`);
      }
    } catch (err) {
      console.error('[FallbackCron] Error releasing expired holds:', err.message);
    }
  }, INTERVAL_MS);
  return intervalHandle;
}

function stopFallbackCron() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[FallbackCron] Stopped seat hold cleanup');
  }
}

module.exports = { startFallbackCron, stopFallbackCron };
