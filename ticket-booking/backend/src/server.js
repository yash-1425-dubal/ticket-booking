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
    await prisma.$connect();
    console.log('Database connected');

    // Start fallback cron for expired seat holds (runs regardless of Redis)
    startFallbackCron();

    // Initialize queues
    initQueues();
    setupWorkers().catch(console.error);

    server.listen(env.PORT, () => {
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
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
