const db = require('../config/db');

const TABLE = 'kyc_submissions';

async function create(payload) { return db(TABLE).insert(payload); }
async function findById(id) { return db(TABLE).where({ id }).first(); }
async function list({ status, page = 1, pageSize = 20 }) {
  const q = db(TABLE).orderBy('submitted_at', 'desc');
  if (status) q.where({ status });
  const offset = (page - 1) * pageSize;
  const data = await q.clone().offset(offset).limit(pageSize);
  const [{ count }] = await db(TABLE).modify((qb) => { if (status) qb.where({ status }); }).count({ count: '*' });
  return { data, total: Number(count || 0) };
}
async function update(id, changes) { return db(TABLE).where({ id }).update(changes); }

module.exports = { TABLE, create, findById, list, update };