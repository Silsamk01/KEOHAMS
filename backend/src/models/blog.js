const db = require('../config/db');
const TABLE = 'posts';

function baseSelect(){
  return db(TABLE).select('*');
}

async function listPublic({ page=1, pageSize=10, q, category, tag }={}) {
  const query = baseSelect().where({ status: 'PUBLISHED' });
  if (category) query.andWhereILike('category', category);
  if (q){
    const like = `%${q}%`;
    query.andWhere(b=> b.whereILike('title', like).orWhereILike('excerpt', like).orWhereILike('content', like));
  }
  if (tag){
    query.whereIn('id', db('post_tags').select('post_id').join('tags','post_tags.tag_id','tags.id').whereILike('tags.name', tag));
  }
  query.orderBy('published_at','desc');
  const rows = await query.limit(pageSize).offset((page-1)*pageSize);
  return attachTags(rows);
}

async function getBySlug(slug){
  const row = await baseSelect().where({ slug }).first();
  if(!row) return null; const [withTags] = await attachTags([row]); return withTags;
}

function listAll({ page=1, pageSize=20, q, category, tag }={}){
  const query = baseSelect();
  if (category) query.whereILike('category', category);
  if (q){
    const like = `%${q}%`;
    query.where(b=> b.whereILike('title', like).orWhereILike('excerpt', like).orWhereILike('content', like));
  }
  if (tag){
    query.whereIn('id', db('post_tags').select('post_id').join('tags','post_tags.tag_id','tags.id').whereILike('tags.name', tag));
  }
  return query.orderBy('created_at','desc').limit(pageSize).offset((page-1)*pageSize);
}

async function create(data){ const [id] = await db(TABLE).insert(data); return id; }
async function update(id, data){ return db(TABLE).where({ id }).update(data); }
async function remove(id){ return db(TABLE).where({ id }).del(); }

async function setTags(postId, tagNames){
  if(!Array.isArray(tagNames)) return [];
  const clean = [...new Set(tagNames.map(t=> t.trim().toLowerCase()).filter(Boolean))];
  const existing = await db('tags').whereIn('name', clean);
  const existingMap = new Map(existing.map(t=>[t.name, t.id]));
  const newOnes = clean.filter(n=> !existingMap.has(n));
  if (newOnes.length){ await db('tags').insert(newOnes.map(n=> ({ name:n }))); }
  const tagRows = await db('tags').whereIn('name', clean);
  const tagIds = tagRows.map(r=> r.id);
  // Remove old links
  await db('post_tags').where({ post_id: postId }).whereNotIn('tag_id', tagIds).del();
  // Insert missing
  const currentLinks = await db('post_tags').where({ post_id: postId });
  const currentSet = new Set(currentLinks.map(l=> l.tag_id));
  const toInsert = tagIds.filter(id=> !currentSet.has(id)).map(tag_id=> ({ post_id: postId, tag_id }));
  if (toInsert.length) await db('post_tags').insert(toInsert);
  return tagRows.map(r=> r.name);
}

async function attachTags(posts){
  if(!posts.length) return posts;
  const ids = posts.map(p=> p.id);
  const rows = await db('post_tags').select('post_id','tags.name').join('tags','post_tags.tag_id','tags.id').whereIn('post_id', ids);
  const map = {};
  rows.forEach(r=>{ (map[r.post_id] = map[r.post_id] || []).push(r.name); });
  return posts.map(p=> ({ ...p, tags: map[p.id] || [] }));
}

async function ensureUniqueSlug(baseSlug, excludeId){
  let slug = baseSlug; let i=2;
  while(true){
    const q = db(TABLE).where({ slug }); if(excludeId) q.andWhereNot({ id: excludeId }); const existing = await q.first();
    if(!existing) return slug;
    slug = `${baseSlug}-${i++}`;
  }
}

module.exports = { TABLE, listPublic, getBySlug, listAll, create, update, remove, setTags, attachTags, ensureUniqueSlug };
