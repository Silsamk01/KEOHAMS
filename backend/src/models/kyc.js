const db = require('../config/db');

const TABLE = 'kyc_submissions';

async function create(payload) { return db(TABLE).insert(payload); }
async function findById(id) { return db(TABLE).where({ id }).first(); }
async function list({ status, page = 1, pageSize = 20 }) {
  const q = db(TABLE + ' as k')
    .leftJoin('users as u', 'u.id', 'k.user_id')
    .select('k.*', 'u.email as user_email', 'u.name as user_name')
    .orderBy('k.submitted_at', 'desc');
  if (status) q.where({ 'k.status': status });
  const offset = (page - 1) * pageSize;
  const data = await q.clone().offset(offset).limit(pageSize);
  // Count with same filters
  const countQuery = db(TABLE + ' as k')
    .leftJoin('users as u', 'u.id', 'k.user_id')
    .modify(qb => { if (status) qb.where({ 'k.status': status }); })
    .count({ count: '*' });
  const [{ count }] = await countQuery;
  return { data, total: Number(count || 0) };
}
async function update(id, changes) { return db(TABLE).where({ id }).update(changes); }

module.exports = { TABLE, create, findById, list, update };