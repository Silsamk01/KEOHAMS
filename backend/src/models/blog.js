const db = require('../config/db');
const TABLE = 'posts';

function baseSelect() {
  return db(TABLE).select('*');
}

async function listPublic({ page = 1, pageSize = 10 } = {}) {
  const q = baseSelect().where({ status: 'PUBLISHED' }).orderBy('published_at', 'desc');
  const items = await q.limit(pageSize).offset((page - 1) * pageSize);
  return items;
}

function getBySlug(slug) {
  return baseSelect().where({ slug }).first();
}

// Admin helpers
function listAll({ page = 1, pageSize = 20 } = {}) {
  return baseSelect().orderBy('created_at', 'desc').limit(pageSize).offset((page - 1) * pageSize);
}

function create(data) { return db(TABLE).insert(data); }
function update(id, data) { return db(TABLE).where({ id }).update(data); }
function remove(id) { return db(TABLE).where({ id }).del(); }

module.exports = { TABLE, listPublic, getBySlug, listAll, create, update, remove };
