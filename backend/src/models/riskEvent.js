const db = require('../config/db');

const TABLE = 'risk_events';

async function log({ user_id, event_type, delta = 0, resulting_score, resulting_level, metadata }) {
  const row = {
    user_id,
    event_type,
    delta,
    resulting_score: resulting_score ?? 0,
    resulting_level: resulting_level || 'LOW',
    metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
  };
  const [id] = await db(TABLE).insert(row);
  return db(TABLE).where({ id }).first();
}

async function listForUser(user_id, { page = 1, pageSize = 50 } = {}) {
  page = Number(page) || 1; pageSize = Math.min(Number(pageSize) || 50, 200);
  const offset = (page - 1) * pageSize;
  const data = await db(TABLE).where({ user_id }).orderBy('id','desc').offset(offset).limit(pageSize);
  const [{ count }] = await db(TABLE).where({ user_id }).count({ count: '*' });
  return { data, total: Number(count || 0) };
}

module.exports = { TABLE, log, listForUser };
