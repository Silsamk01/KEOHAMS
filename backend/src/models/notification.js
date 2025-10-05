const db = require('../config/db');

const TABLE = 'notifications';
const READS = 'notification_reads';
const HIDES = 'notification_hides';
let hidesTableChecked = false; // cache check result
let hidesTableExists = false;

async function ensureHidesExists(dbInstance){
  if (hidesTableChecked) return hidesTableExists;
  try {
     const exists = await dbInstance.schema.hasTable(HIDES);
     hidesTableExists = !!exists; hidesTableChecked = true;
  } catch(_){ hidesTableExists = false; hidesTableChecked = true; }
  return hidesTableExists;
}

module.exports = {
  TABLE,
  READS,
  async create({ title, body, audience='ALL', user_id=null, url=null }) {
    return db(TABLE).insert({ title, body, audience, user_id, url });
  },
  async remove(id) {
    return db(TABLE).where({ id }).del();
  },
  async listAll({ page=1, pageSize=20, q='' } = {}) {
    const base = db(TABLE).select('*').modify((qb)=>{
      if (q) qb.whereILike(`${TABLE}.title`, `%${q}%`).orWhereILike(`${TABLE}.body`, `%${q}%`);
    }).orderBy(`${TABLE}.id`,'desc');
    const offset = (page-1)*pageSize;
    const data = await base.clone().offset(offset).limit(pageSize);
    const [{ count }] = await db(TABLE).modify((qb)=>{
      if (q) qb.whereILike(`${TABLE}.title`, `%${q}%`).orWhereILike(`${TABLE}.body`, `%${q}%`);
    }).count({ count: '*' });
    return { data, total: Number(count||0) };
  },
  async listForUser(userId, { page=1, pageSize=20 } = {}) {
    const hideOK = await ensureHidesExists(db);
    const base = db(TABLE)
      .modify(qb=>{ if (hideOK) qb.leftJoin(HIDES, function(){ this.on(`${HIDES}.notification_id`, '=', `${TABLE}.id`).andOn(`${HIDES}.user_id`, '=', db.raw('?', [userId])); }); })
      .select(`${TABLE}.*`)
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .modify(qb=>{ if (hideOK) qb.whereNull(`${HIDES}.id`); })
      .orderBy(`${TABLE}.id`,'desc');
    const offset = (page-1)*pageSize;
    const data = await base.clone().offset(offset).limit(pageSize);
    const [{ count }] = await db(TABLE)
      .modify(qb=>{ if (hideOK) qb.leftJoin(HIDES, function(){ this.on(`${HIDES}.notification_id`, '=', `${TABLE}.id`).andOn(`${HIDES}.user_id`, '=', db.raw('?', [userId])); }); })
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .modify(qb=>{ if (hideOK) qb.whereNull(`${HIDES}.id`); })
      .count({ count: '*' });
    return { data, total: Number(count||0) };
  },
  async unreadCount(userId) {
    const hideOK = await ensureHidesExists(db);
    const [{ count }] = await db(TABLE)
      .leftJoin(READS, function(){ this.on(`${READS}.notification_id`, '=', `${TABLE}.id`).andOn(`${READS}.user_id`, '=', db.raw('?', [userId])); })
      .modify(qb=>{ if (hideOK) qb.leftJoin(HIDES, function(){ this.on(`${HIDES}.notification_id`, '=', `${TABLE}.id`).andOn(`${HIDES}.user_id`, '=', db.raw('?', [userId])); }); })
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .whereNull(`${READS}.id`)
      .modify(qb=>{ if (hideOK) qb.whereNull(`${HIDES}.id`); })
      .count({ count: '*' });
    return Number(count||0);
  },
  async hideForUser(userId, notificationId){
    const hideOK = await ensureHidesExists(db);
    if (!hideOK) return; // silently ignore if migration not yet applied
    try { await db(HIDES).insert({ notification_id: notificationId, user_id: userId }); } catch(_){ /* ignore dup */ }
  },
  async markRead(userId, notificationId) {
    try {
      await db(READS).insert({ notification_id: notificationId, user_id: userId });
    } catch (_) {
      // ignore duplicate
    }
  },
  async markAllRead(userId) {
    // Get ids of notifications visible to user and not yet read
    const rows = await db(TABLE)
      .leftJoin(READS, function(){ this.on(`${READS}.notification_id`, '=', `${TABLE}.id`).andOn(`${READS}.user_id`, '=', db.raw('?', [userId])); })
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .whereNull(`${READS}.id`)
      .select(`${TABLE}.id as id`);
    if (!rows.length) return { inserted: 0, ids: [] };
    const toInsert = rows.map(r => ({ notification_id: r.id, user_id: userId }));
    for (const rec of toInsert) {
      try { await db(READS).insert(rec); } catch (_) { /* ignore dup */ }
    }
    return { inserted: toInsert.length, ids: rows.map(r=>r.id) };
  }
};
