const db = require('../config/db');

async function findOrCreateByName(name){
  const trimmed = name.trim().toLowerCase();
  if(!trimmed) return null;
  const existing = await db('tags').whereRaw('LOWER(name)=?', [trimmed]).first();
  if (existing) return existing.id;
  const [id] = await db('tags').insert({ name: trimmed });
  return id;
}

async function listAll(){
  return db('tags').select('*').orderBy('name','asc');
}

module.exports = { findOrCreateByName, listAll };
