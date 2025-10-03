const db = require('../config/db');

const THREADS = 'chat_threads';
const MESSAGES = 'chat_messages';
const MSG_HIDES = 'chat_message_hides';
const TH_HIDES = 'chat_thread_hides';

async function findOrCreateThreadForProduct({ user_id, product_id, subject, created_by }) {
  // Ensure single thread per user/product
  let thread = await db(THREADS).where({ user_id, product_id }).first();
  if (!thread) {
    const [id] = await db(THREADS).insert({ user_id, product_id, subject: subject || null, created_by });
    thread = await db(THREADS).where({ id }).first();
    return { thread, created: true };
  }
  return { thread, created: false };
}

async function createThread({ user_id, product_id = null, subject = null, created_by }) {
  const [id] = await db(THREADS).insert({ user_id, product_id, subject, created_by });
  return db(THREADS).where({ id }).first();
}

async function getThreadById(id) { return db(THREADS).where({ id }).first(); }

async function listThreadsForUser(user_id) {
  return db(THREADS)
    .leftJoin('products', 'products.id', '=', `${THREADS}.product_id`)
    .leftJoin({ th: TH_HIDES }, function(){ this.on('th.thread_id', '=', `${THREADS}.id`).andOn('th.user_id', '=', db.raw('?', [user_id])); })
    .select(`${THREADS}.*`, 'products.title as product_title')
    .where(`${THREADS}.user_id`, user_id)
    .whereNull('th.id')
    .orderBy(`${THREADS}.created_at`, 'desc');
}

async function listThreadsForAdmin() {
  return db(THREADS)
    .leftJoin('products', 'products.id', '=', `${THREADS}.product_id`)
    .leftJoin('users', 'users.id', '=', `${THREADS}.user_id`)
    .select(
      `${THREADS}.*`,
      'products.title as product_title',
      'users.name as user_name',
      'users.email as user_email'
    )
    .orderBy(`${THREADS}.created_at`, 'desc');
}

async function addMessage({ thread_id, sender_id, body }) {
  const [id] = await db(MESSAGES).insert({ thread_id, sender_id, body });
  return db(MESSAGES).where({ id }).first();
}

async function listMessages(thread_id, { limit = 100, beforeId, viewer_id } = {}) {
  let q = db(MESSAGES)
    .leftJoin({ mh: MSG_HIDES }, function(){ this.on('mh.message_id', '=', `${MESSAGES}.id`).andOn('mh.user_id', '=', db.raw('?', [viewer_id||0])); })
    .where(`${MESSAGES}.thread_id`, thread_id)
    .whereNull('mh.id')
    .select(`${MESSAGES}.*`)
    .orderBy(`${MESSAGES}.id`, 'desc');
  if (beforeId) q = q.andWhere('id', '<', beforeId);
  const rows = await q.limit(limit);
  return rows.reverse();
}

async function hideMessage({ message_id, user_id }) {
  try { await db(MSG_HIDES).insert({ message_id, user_id }); } catch(_) { /* ignore dup */ }
}

async function hideThread({ thread_id, user_id }) {
  try { await db(TH_HIDES).insert({ thread_id, user_id }); } catch(_) { /* ignore dup */ }
}

async function hardDeleteThread(thread_id) {
  return db(THREADS).where({ id: thread_id }).del();
}

module.exports = {
  THREADS,
  MESSAGES,
  findOrCreateThreadForProduct,
  createThread,
  getThreadById,
  listThreadsForUser,
  listThreadsForAdmin,
  addMessage,
  listMessages,
  hideMessage,
  hideThread,
  hardDeleteThread,
};
