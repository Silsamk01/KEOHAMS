const knex = require('../config/db');

async function create(data){
  const [id] = await knex('contact_messages').insert(data);
  return findById(id);
}
async function findById(id){
  return knex('contact_messages').where({ id }).first();
}
async function list({ page=1, pageSize=20, unreadOnly=false }){
  page = Number(page)||1; pageSize = Math.min(Number(pageSize)||20, 100);
  const q = knex('contact_messages').orderBy('created_at','desc');
  if (unreadOnly) q.where({ is_read:false });
  const items = await q.limit(pageSize).offset((page-1)*pageSize);
  const [{ count }] = await knex('contact_messages').count({ count: '*' });
  return { data: items, page, pageSize, total: Number(count) };
}
async function markRead(id){
  await knex('contact_messages').where({ id }).update({ is_read:true });
  return findById(id);
}

module.exports = { create, findById, list, markRead };
