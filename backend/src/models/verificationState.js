const db = require('../config/db');

const TABLE = 'user_verification_state';

function baseSelect() {
  return db(TABLE).select('*');
}

async function ensureRow(user_id) {
  const existing = await db(TABLE).where({ user_id }).first();
  if (existing) return existing;
  const [id] = await db(TABLE).insert({ user_id });
  return db(TABLE).where({ id }).first();
}

async function findByUser(user_id) {
  return db(TABLE).where({ user_id }).first();
}

async function updateByUser(user_id, changes) {
  await db(TABLE).where({ user_id }).update(changes);
  return findByUser(user_id);
}

module.exports = { TABLE, ensureRow, findByUser, updateByUser };
