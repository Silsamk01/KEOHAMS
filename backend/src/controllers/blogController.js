const db = require('../config/db');
const Blog = require('../models/blog');

// Auth-required list (we enforce login at route layer change later)
async function list(req, res) {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize || '10', 10) || 10, 50);
  const includeMeta = req.query.meta === '1';
  const q = (req.query.q || '').trim() || undefined;
  const category = (req.query.category || '').trim() || undefined;
  const tag = (req.query.tag || '').trim() || undefined;
  const items = await Blog.listPublic({ page, pageSize, q, category, tag });
  if (!includeMeta) return res.json(items);
  const countQuery = db(Blog.TABLE).where({ status: 'PUBLISHED' });
  if (category) countQuery.andWhereILike('category', category);
  if (q) countQuery.andWhere(b => b.whereILike('title', `%${q}%`).orWhereILike('excerpt', `%${q}%`).orWhereILike('content', `%${q}%`));
  if (tag) countQuery.whereIn('id', db('post_tags').select('post_id').join('tags','post_tags.tag_id','tags.id').whereILike('tags.name', tag));
  const [{ count }] = await countQuery.count({ count: '*' });
  const total = Number(count) || 0;
  const data = items.map(p => ({
    ...p,
    excerpt: p.excerpt || (p.content ? p.content.replace(/\n+/g,' ').slice(0,160) : null)
  }));
  res.json({ page, pageSize, total, hasMore: page * pageSize < total, data });
}

// Get by slug (auth already enforced at route for new private blog access)
async function getBySlug(req, res) {
  const slug = req.params.slug;
  const post = await Blog.getBySlug(slug);
  if (!post || post.status !== 'PUBLISHED') return res.status(404).json({ message: 'Not found' });
  // Increment view_count best-effort
  try { await db(Blog.TABLE).where({ id: post.id }).increment('view_count', 1); } catch(_){ }
  res.json(post);
}

// Admin CRUD
async function adminList(req, res) {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize || '20', 10) || 20, 100);
  const q = (req.query.q || '').trim() || undefined;
  const category = (req.query.category || '').trim() || undefined;
  const items = await Blog.listAll({ page, pageSize, q, category });
  res.json(items);
}

async function create(req, res) {
  const { title, slug, excerpt, content, require_login, status, published_at, category, tags, cover_image, seo_title, seo_description } = req.body;
  if (!title || !content) return res.status(400).json({ message: 'title & content required' });
  const baseSlug = (slug || title).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'post';
  const uniqueSlug = await Blog.ensureUniqueSlug(baseSlug);
  const words = content.split(/\s+/).filter(Boolean).length;
  const reading_minutes = Math.max(1, Math.ceil(words / 200));
  const data = {
    title,
    slug: uniqueSlug,
    excerpt: excerpt || null,
    content,
    require_login: !!require_login, // will likely always be true in new model (all gated) but leave for flexibility
    status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    author_id: req.user?.sub || null,
    published_at: status === 'PUBLISHED' ? (published_at || new Date()) : null,
    category: category || null,
    cover_image: cover_image || null,
    reading_minutes,
    seo_title: seo_title || null,
    seo_description: seo_description || null
  };
  const id = await Blog.create(data);
  if (tags) await Blog.setTags(id, Array.isArray(tags)? tags : String(tags).split(',') );
  const created = await Blog.getBySlug(data.slug);
  res.status(201).json(created);
}

async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  const { title, slug, excerpt, content, require_login, status, published_at, category, tags, cover_image, seo_title, seo_description } = req.body;
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (slug !== undefined) {
    const base = slug.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    patch.slug = await Blog.ensureUniqueSlug(base, id);
  }
  if (excerpt !== undefined) patch.excerpt = excerpt;
  if (content !== undefined) {
    patch.content = content;
    const words = content.split(/\s+/).filter(Boolean).length;
    patch.reading_minutes = Math.max(1, Math.ceil(words/200));
  }
  if (require_login !== undefined) patch.require_login = !!require_login;
  if (status !== undefined) {
    patch.status = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
    if (patch.status === 'PUBLISHED') patch.published_at = published_at || new Date();
    else patch.published_at = null;
  }
  if (category !== undefined) patch.category = category || null;
  if (cover_image !== undefined) patch.cover_image = cover_image || null;
  if (seo_title !== undefined) patch.seo_title = seo_title || null;
  if (seo_description !== undefined) patch.seo_description = seo_description || null;
  await Blog.update(id, patch);
  if (tags !== undefined) await Blog.setTags(id, Array.isArray(tags)? tags : String(tags).split(','));
  const updated = await db(Blog.TABLE).where({ id }).first();
  const [withTags] = await Blog.attachTags([updated]);
  res.json(withTags);
}

async function remove(req, res) {
  const id = parseInt(req.params.id, 10);
  await Blog.remove(id);
  res.json({ message: 'Deleted' });
}

async function publish(req, res){
  const id = parseInt(req.params.id, 10);
  await Blog.update(id, { status:'PUBLISHED', published_at: new Date() });
  res.json({ message:'Published' });
}
async function unpublish(req, res){
  const id = parseInt(req.params.id, 10);
  await Blog.update(id, { status:'DRAFT', published_at: null });
  res.json({ message:'Unpublished' });
}

module.exports = { list, getBySlug, adminList, create, update, remove, publish, unpublish };
