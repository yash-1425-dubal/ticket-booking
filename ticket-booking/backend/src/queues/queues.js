const { Queue } = require('bullmq');
const connection = require('./connection');

const queues = {};

const QUEUE_NAMES = ['email', 'waitlist', 'seat-cleanup'];

function getQueue(name) {
  if (!connection.isReady) return null;
  if (!queues[name]) {
    try {
      queues[name] = new Queue(name, { connection: connection.client });
    } catch {
      queues[name] = null;
    }
  }
  return queues[name];
}

function initQueues() {
  if (!connection.isReady) {
    console.warn('Redis unavailable, queues disabled');
    return;
  }
  for (const name of QUEUE_NAMES) {
    getQueue(name);
    console.log(`Queue initialized: ${name}`);
  }
}

module.exports = { getQueue, initQueues };
