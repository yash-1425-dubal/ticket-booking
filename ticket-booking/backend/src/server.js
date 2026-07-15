const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { initSocketServer } = require('./sockets');
const { initQueues, getQueue } = require('./queues/queues');
const { setupWorkers } = require('./queues/workers');
const { startFallbackCron } = require('./queues/fallbackCron');

// Bull Board for queue monitoring
let bullBoardSetup = false;
async function setupBullBoard() {
  if (bullBoardSetup) return;
  try {
    const { createBullBoard } = require('@bull-board/api');
    const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
    const { ExpressAdapter } = require('@bull-board/express');

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    const queueNames = ['email', 'waitlist', 'seat-cleanup'];
    const bullQueues = queueNames.map(name => {
      const queue = getQueue(name);
      return queue ? new BullMQAdapter(queue) : null;
    }).filter(Boolean);

    if (bullQueues.length > 0) {
      createBullBoard({
        queues: bullQueues,
        serverAdapter,
      });
      app.use('/admin/queues', serverAdapter.getRouter());
      console.log('[BullBoard] Queue dashboard available at /admin/queues');
    }
    bullBoardSetup = true;
  } catch (err) {
    console.warn('[BullBoard] Setup failed:', err.message);
  }
}

const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocketServer(server);

// Make io accessible to routes
app.set('io', io);

async function start() {
  try {
    console.log('[START] Starting fallback cron...');
    startFallbackCron();

    console.log('[START] Initializing queues...');
    initQueues();

    console.log('[START] Setting up workers...');
    setupWorkers().catch(console.error);

    console.log('[START] Setting up Bull Board...');
    await setupBullBoard();

    console.log('[START] Starting server on port', env.PORT, '...');
    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[START] Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('[START] Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

start();

module.exports = server;
