const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { verify } = require('./utils/jwt');
const logger = require('./utils/logger');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// Expose io to Express controllers
app.set('io', io);

// Socket.IO auth via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = verify(token);
    socket.user = payload; // { sub, role, ... }
    return next();
  } catch (e) {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.sub;
  if (userId) socket.join(`user:${userId}`);
  if (socket.user?.role === 'ADMIN') socket.join('admins');
  if (userId) socket.join('users');

  // Join a chat thread room
  socket.on('thread:join', ({ thread_id }) => {
    if (!thread_id) return;
    socket.join(`thread:${thread_id}`);
  });

  // Mirror ping/pong for diagnostics
  socket.on('ping', () => socket.emit('pong'));

  // Typing indicators
  socket.on('typing:start', ({ thread_id }) => {
    if (!thread_id) return;
    // Broadcast to others in the thread room
    socket.to(`thread:${thread_id}`).emit('typing:start', { thread_id, user_id: userId });
  });
  socket.on('typing:stop', ({ thread_id }) => {
    if (!thread_id) return;
    socket.to(`thread:${thread_id}`).emit('typing:stop', { thread_id, user_id: userId });
  });
});

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Server listening');
  try {
    const { verifyTransport } = require('./utils/email');
    verifyTransport()
      .then(() => logger.info('SMTP transport OK'))
      .catch((e)=> logger.warn({ err: e }, 'SMTP verify failed'));
  } catch (e) { logger.warn('SMTP not configured'); }
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled Rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  // Optionally: graceful shutdown
});
