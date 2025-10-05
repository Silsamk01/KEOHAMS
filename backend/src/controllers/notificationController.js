const Notifications = require('../models/notification');
const ReadEvents = require('../models/notificationReadEvent');

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
  try {
    // persist read event
    ReadEvents.log(req.user.sub, id);
    const io = req.app.get('io');
    if (io) io.to('admins').emit('notif:read', { user_id: req.user.sub, notification_id: id });
  } catch(_){}
  res.json({ message: 'OK' });
};

exports.markAllRead = async (req, res) => {
  const result = await Notifications.markAllRead(req.user.sub);
  try {
    const io = req.app.get('io');
    if (io && result.ids && result.ids.length) {
      // bulk persist
      for (const nid of result.ids) ReadEvents.log(req.user.sub, nid);
      io.to('admins').emit('notif:read:bulk', { user_id: req.user.sub, notification_ids: result.ids });
    }
  } catch(_){ }
  res.json({ message: 'OK', ...result });
};

// User hide (soft delete for that user only)
exports.deleteMine = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid id' });
  // Ensure the notification is actually visible to this user before hiding
  const { data } = await Notifications.listForUser(req.user.sub, { page:1, pageSize:1 });
  // Simpler check: attempt to hide regardless; hide will just record row if exists
  await Notifications.hideForUser(req.user.sub, id);
  res.json({ message: 'Deleted' });
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
