const Notifications = require('../models/notification');

// User-facing
exports.listMine = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const { data, total } = await Notifications.listForUser(req.user.sub, { page, pageSize });
  res.json({ data, total });
};

exports.unreadCount = async (req, res) => {
  const count = await Notifications.unreadCount(req.user.sub);
  res.json({ count });
};

exports.markRead = async (req, res) => {
  const id = Number(req.params.id);
  await Notifications.markRead(req.user.sub, id);
  res.json({ message: 'OK' });
};

exports.markAllRead = async (req, res) => {
  const result = await Notifications.markAllRead(req.user.sub);
  res.json({ message: 'OK', ...result });
};

// Admin
exports.adminList = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || '').trim();
  const { data, total } = await Notifications.listAll({ page, pageSize, q });
  res.json({ data, total });
};

exports.adminCreate = async (req, res) => {
  const { title, body, audience='ALL', user_id=null, url=null } = req.body;
  if (!title || !body) return res.status(400).json({ message: 'Missing title/body' });
  if (!['ALL','USER'].includes(audience)) return res.status(400).json({ message: 'Invalid audience' });
  if (audience === 'USER' && !user_id) return res.status(400).json({ message: 'user_id required for USER audience' });
  const [id] = await Notifications.create({ title, body, audience, user_id, url });
  try {
    const io = req.app.get('io');
    if (io) {
      if (audience === 'ALL') {
        io.to('users').emit('notif:new', { id, title, body, url });
      } else if (audience === 'USER' && user_id) {
        io.to(`user:${user_id}`).emit('notif:new', { id, title, body, url });
      }
    }
  } catch(_){ }
  res.json({ id });
};

exports.adminDelete = async (req, res) => {
  const id = Number(req.params.id);
  await Notifications.remove(id);
  res.json({ message: 'Deleted' });
};
