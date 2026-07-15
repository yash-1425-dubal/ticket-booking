const http = require('http');
const app = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');
const { initSocketServer } = require('./sockets');
const { initQueues } = require('./queues/queues');
const { setupWorkers } = require('./queues/workers');
const { startFallbackCron } = require('./queues/fallbackCron');

const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocketServer(server);

// Make io accessible to routes
app.set('io', io);

async function start() {
  try {
    console.log('[START] Connecting to database...');
    await prisma.$connect();
    console.log('[START] Database connected');

    // Start fallback cron for expired seat holds (runs regardless of Redis)
    console.log('[START] Starting fallback cron...');
    startFallbackCron();

    // Initialize queues
    console.log('[START] Initializing queues...');
    initQueues();

    console.log('[START] Setting up workers...');
    setupWorkers().catch(console.error);

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
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

start();

module.exports = server;
