const db = require('../config/db');
const Blog = require('../models/blog');

// Public list of published posts
async function list(req, res) {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize || '10', 10) || 10, 50);
  const items = await Blog.listPublic({ page, pageSize });
  res.json(items);
}

// Public get by slug with auth-gating if require_login
async function getBySlug(req, res) {
  const slug = req.params.slug;
  const post = await Blog.getBySlug(slug);
  if (!post || post.status !== 'PUBLISHED') return res.status(404).json({ message: 'Not found' });
  if (post.require_login) {
    // Optional check: req.user set by auth middleware if present
    if (!req.user) return res.status(401).json({ message: 'Login required' });
  }
  res.json(post);
}

// Admin CRUD
async function adminList(req, res) {
  const page = parseInt(req.query.page || '1', 10) || 1;
  const pageSize = Math.min(parseInt(req.query.pageSize || '20', 10) || 20, 100);
  const items = await Blog.listAll({ page, pageSize });
  res.json(items);
}

async function create(req, res) {
  const { title, slug, excerpt, content, require_login, status, published_at } = req.body;
  if (!title || !slug || !content) return res.status(400).json({ message: 'title, slug, content required' });
  const data = {
    title,
    slug,
    excerpt: excerpt || null,
    content,
    require_login: !!require_login,
    status: status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    author_id: req.user?.sub || null,
    published_at: status === 'PUBLISHED' ? (published_at || new Date()) : null
  };
  await Blog.create(data);
  res.status(201).json({ message: 'Created' });
}

async function update(req, res) {
  const id = parseInt(req.params.id, 10);
  const { title, slug, excerpt, content, require_login, status, published_at } = req.body;
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (slug !== undefined) patch.slug = slug;
  if (excerpt !== undefined) patch.excerpt = excerpt;
  if (content !== undefined) patch.content = content;
  if (require_login !== undefined) patch.require_login = !!require_login;
  if (status !== undefined) patch.status = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  if (patch.status === 'PUBLISHED') patch.published_at = published_at || new Date();
  await Blog.update(id, patch);
  res.json({ message: 'Updated' });
}

async function remove(req, res) {
  const id = parseInt(req.params.id, 10);
  await Blog.remove(id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getBySlug, adminList, create, update, remove };
