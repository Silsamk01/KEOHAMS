const db = require('../config/db');

const TABLE = 'notifications';
const READS = 'notification_reads';

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
    const base = db(TABLE)
      .select(`${TABLE}.*`)
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .orderBy(`${TABLE}.id`,'desc');
    const offset = (page-1)*pageSize;
    const data = await base.clone().offset(offset).limit(pageSize);
    const [{ count }] = await db(TABLE)
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .count({ count: '*' });
    return { data, total: Number(count||0) };
  },
  async unreadCount(userId) {
    const [{ count }] = await db(TABLE)
      .leftJoin(READS, function(){ this.on(`${READS}.notification_id`, '=', `${TABLE}.id`).andOn(`${READS}.user_id`, '=', db.raw('?', [userId])); })
      .where(builder => {
        builder.where(`${TABLE}.audience`,'ALL').orWhere(qb => qb.where(`${TABLE}.audience`,'USER').andWhere(`${TABLE}.user_id`, userId));
      })
      .whereNull(`${READS}.id`)
      .count({ count: '*' });
    return Number(count||0);
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
    if (!rows.length) return { inserted: 0 };
    const toInsert = rows.map(r => ({ notification_id: r.id, user_id: userId }));
    for (const rec of toInsert) {
      try { await db(READS).insert(rec); } catch (_) { /* ignore dup */ }
    }
    return { inserted: toInsert.length };
  }
};
