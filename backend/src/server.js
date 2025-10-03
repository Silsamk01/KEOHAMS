const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { verify } = require('./utils/jwt');
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
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  // Verify SMTP transport once on boot (non-fatal)
  try {
    const { verifyTransport } = require('./utils/email');
    verifyTransport().then(() => console.log('SMTP: transport OK')).catch((e)=> console.warn('SMTP: verify failed -', e.message));
  } catch (e) {
    console.warn('SMTP: not configured');
  }
});
