const db = require('../config/db');

const TABLE = 'verification_state_events';

async function log({ user_id, from_status, to_status, actor_id=null, metadata=null }, trx) {
  const row = {
    user_id,
    from_status,
    to_status,
    actor_id,
    metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
  };
  const q = (trx || db)(TABLE).insert(row);
  const [id] = await q;
  return (trx || db)(TABLE).where({ id }).first();
}

async function listForUser(user_id, { page=1, pageSize=50 } = {}) {
  page = Number(page)||1; pageSize = Math.min(Number(pageSize)||50, 200);
  const offset = (page-1)*pageSize;
  const data = await db(TABLE).where({ user_id }).orderBy('id','desc').offset(offset).limit(pageSize);
  const [{ count }] = await db(TABLE).where({ user_id }).count({ count: '*' });
  return { data, total: Number(count||0) };
}

module.exports = { TABLE, log, listForUser };
