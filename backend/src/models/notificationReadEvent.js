const knex = require('../config/db');

async function log(user_id, notification_id){
  if (!user_id || !notification_id) return;
  try { await knex('notification_read_events').insert({ user_id, notification_id }); } catch(e){ /* swallow duplicates or errors */ }
}

async function recent({ limit=30 }={}){
  limit = Math.min(Math.max(Number(limit)||30,1),100);
  const rows = await knex('notification_read_events')
    .select('*')
    .orderBy('created_at','desc')
    .limit(limit);
  return rows;
}

module.exports = { log, recent };