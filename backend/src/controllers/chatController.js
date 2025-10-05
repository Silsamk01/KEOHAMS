const db = require('../config/db');
const chat = require('../models/chat');
const { sendMail } = require('../utils/email');

// Helper: compute unread messages for a given user (messages from the other party not yet seen)
async function computeUnread(userId) {
  const rows = await db('chat_messages as m')
    .join('chat_threads as t', 't.id', 'm.thread_id')
    .where('t.user_id', userId)
    .andWhere('m.sender_id', '!=', userId)
    .whereNull('m.seen_at');
  return rows.length;
}

async function startThread(req, res) {
  const userId = req.user.sub;
  const { product_id, subject, message } = req.body;
  let thread; let createdFlag = false;
  if (product_id) {
    const product = await db('products').where({ id: product_id }).first();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const resFOC = await chat.findOrCreateThreadForProduct({ user_id: userId, product_id, subject: subject || `Inquiry about ${product.title}`, created_by: userId });
    thread = resFOC.thread; createdFlag = resFOC.created;
  } else {
    thread = await chat.createThread({ user_id: userId, subject: subject || 'New chat', created_by: userId });
    createdFlag = true;
  }
  if (message) await chat.addMessage({ thread_id: thread.id, sender_id: userId, body: message });
  // Notify admins of new thread
  try {
    const io = req.app.get('io');
    if (io) io.to('admins').emit('admin:thread:new', { thread });
  } catch(_){}
  // Email user confirming chat created — only on initial creation
  if (createdFlag) {
    try {
      const user = await db('users').where({ id: userId }).first();
      if (user?.email) {
        await sendMail({
          to: user.email,
          subject: 'We received your inquiry',
          html: `<p>Hi ${user.name || ''},</p>
                 <p>Your chat has been started${thread.product_id ? ' about product #'+thread.product_id : ''}. We'll get back to you shortly.</p>
                 <p>You can continue the conversation from your dashboard.</p>`
        });
      }
    } catch(_e){}
  }
  res.json({ data: thread });
}

async function listThreadsMine(req, res) {
  const userId = req.user.sub;
  const data = await chat.listThreadsForUser(userId);
  res.json({ data });
}

async function listMessages(req, res) {
  const userId = req.user.sub;
  const { id } = req.params; // thread id
  const thread = await chat.getThreadById(id);
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  if (req.user.role !== 'ADMIN' && thread.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
    const data = await chat.listMessages(id, { limit: Number(req.query.limit) || 100, beforeId: req.query.beforeId, viewer_id: req.user.sub });
  res.json({ data });
}

async function postMessage(req, res) {
  const userId = req.user.sub;
  const { id } = req.params; // thread id
  const { body } = req.body;
  if (typeof body !== 'string') return res.status(400).json({ message: 'Message required' });
  const trimmed = body.trim();
  if (!trimmed) return res.status(400).json({ message: 'Message required' });
  if (trimmed.length > 5000) return res.status(400).json({ message: 'Message too long' });

  const thread = await chat.getThreadById(id);
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  if (req.user.role !== 'ADMIN' && thread.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });

  const msg = await chat.addMessage({ thread_id: thread.id, sender_id: userId, body: trimmed });

  try {
    const io = req.app.get('io');
    if (io) {
      // Always emit the new message to thread room & admins monitor room
      io.to(`thread:${thread.id}`).emit('message:new', { thread_id: thread.id, message: msg });
      io.to('admins').emit('admin:message:new', { thread_id: thread.id, message: msg });
      if (req.user.role === 'ADMIN') {
        // Direct notification to the user for an admin reply
        io.to(`user:${thread.user_id}`).emit('user:message:new', { thread_id: thread.id, message: msg });
        // Update unread count for user (admin message increases unread until user views)
        const unread = await computeUnread(thread.user_id);
        io.to(`user:${thread.user_id}`).emit('unread:update', { count: unread });
        // Thread meta update (user perspective)
        io.to(`user:${thread.user_id}`).emit('thread:update', {
          thread_id: thread.id,
          last_message_body: trimmed,
          last_message_created_at: msg.created_at,
          unread
        });
        // Also push thread meta update to all admins so their thread list reflects latest message
        io.to('admins').emit('thread:update', {
          thread_id: thread.id,
          last_message_body: trimmed,
          last_message_created_at: msg.created_at,
          user_id: thread.user_id
        });
      } else {
        // Optionally email admin on user message if env flag set (CHAT_EMAIL_ADMIN_ON_USER=1)
        if (process.env.CHAT_EMAIL_ADMIN_ON_USER === '1' && process.env.ADMIN_EMAIL) {
          try {
            await sendMail({
              to: process.env.ADMIN_EMAIL,
              subject: 'New user chat message',
              html: `<p>User #${thread.user_id} posted a new message in thread #${thread.id}.</p><p>${trimmed.replace(/</g,'&lt;')}</p>`
            });
          } catch (_) { /* ignore */ }
        }
        // For admins monitoring dashboard: push meta
        io.to('admins').emit('thread:update', {
          thread_id: thread.id,
          last_message_body: trimmed,
          last_message_created_at: msg.created_at,
          user_id: thread.user_id
        });
      }
    }
  } catch (_) { /* ignore socket errors */ }

  // Email user if admin replied
  if (req.user.role === 'ADMIN') {
    try {
      const user = await db('users').where({ id: thread.user_id }).first();
      if (user?.email) {
        await sendMail({
          to: user.email,
          subject: 'New reply to your chat',
          html: `<p>Hi ${user.name || ''},</p>
                 <p>You have a new reply in your chat${thread.product_id ? ' about a product' : ''}.</p>
                 <p>Please open your dashboard to view and reply.</p>`
        });
      }
    } catch (_) { /* swallow email errors */ }
  }

  res.status(201).json({ data: msg });
}

// Admin endpoints
async function adminListThreads(_req, res) {
  const data = await chat.listThreadsForAdmin();
  res.json({ data });
}

// Unread counts and seen markers (simple: count unseen messages from the other party)
async function unreadCount(req, res) {
  try {
    const count = await computeUnread(req.user.sub);
    res.json({ count });
  } catch (e) {
    console.error('unreadCount error', e.message);
    res.json({ count: 0 });
  }
}

async function markSeen(req, res) {
  const userId = req.user.sub; const { id } = req.params;
  const thread = await chat.getThreadById(id);
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  if (thread.user_id !== userId && req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  await db('chat_messages')
    .where({ thread_id: id })
    .andWhere('sender_id', '!=', userId)
    .whereNull('seen_at')
    .update({ seen_at: db.fn.now() });
  // After marking as seen, emit updated unread count (likely 0) to the user
  try {
    if (req.user.role !== 'ADMIN') {
      const io = req.app.get('io');
      if (io) {
        const unread = await computeUnread(userId);
        io.to(`user:${userId}`).emit('unread:update', { count: unread });
      }
    }
  } catch (_) {}
  res.json({ ok: true });
}

module.exports = { startThread, listThreadsMine, listMessages, postMessage, adminListThreads, unreadCount, markSeen };

// --- Hiding and deletion endpoints ---
// Allow a user or admin to hide a single message from their own view
async function hideMessage(req, res) {
  const userId = req.user.sub; const { id } = req.params; // message id
  const row = await db('chat_messages as m')
    .join('chat_threads as t', 't.id', 'm.thread_id')
    .select('m.id as message_id', 'm.thread_id', 't.user_id')
    .where('m.id', id)
    .first();
  if (!row) return res.status(404).json({ message: 'Message not found' });
  if (req.user.role !== 'ADMIN' && row.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
  await chat.hideMessage({ message_id: row.message_id, user_id: userId });
  res.json({ ok: true });
}

// Hide an entire thread from the caller's view (soft-delete for that user/admin only)
async function hideThread(req, res) {
  const userId = req.user.sub; const { id } = req.params; // thread id
  const thread = await chat.getThreadById(id);
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  if (req.user.role !== 'ADMIN' && thread.user_id !== userId) return res.status(403).json({ message: 'Forbidden' });
  await chat.hideThread({ thread_id: thread.id, user_id: userId });
  res.json({ ok: true });
}

// Admin-only: permanently delete a thread
async function adminDeleteThread(req, res) {
  const { id } = req.params; // thread id
  const thread = await chat.getThreadById(id);
  if (!thread) return res.status(404).json({ message: 'Thread not found' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  await chat.hardDeleteThread(thread.id);
  res.json({ ok: true });
}

module.exports.hideMessage = hideMessage;
module.exports.hideThread = hideThread;
module.exports.adminDeleteThread = adminDeleteThread;
