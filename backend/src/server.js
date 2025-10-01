const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

// Socket.IO basic auth via query token (will improve to proper header/JWT handshake)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  // TODO: verify JWT here and attach user info
  // For now, allow connection if token exists
  if (!token) return next();
  return next();
});

io.on('connection', (socket) => {
  // Placeholder events
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
