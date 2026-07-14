const { Server } = require('socket.io');
const env = require('../config/env');

let ioInstance = null;

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join event room to receive seat updates
    socket.on('join-event', (eventId) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
        console.log(`Socket ${socket.id} joined event:${eventId}`);
      }
    });

    socket.on('leave-event', (eventId) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });

    // Join personal room for notifications
    socket.on('join-user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  ioInstance = io;
  console.log('Socket.IO initialized');
  return io;
}

function getSocketServer() {
  return ioInstance;
}

module.exports = { initSocketServer, getSocketServer };
