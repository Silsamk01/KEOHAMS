/**
 * Public Blog Controller
 * Reads from public blog database (no authentication required)
 * Content is synced from main database by admin
 */
const publicDb = require('../config/publicDb');

/**
 * List published posts from public database
 * No authentication required - public endpoint
 */
async function listPublic(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize || '10', 10) || 10, 50);
    const includeMeta = req.query.meta === '1';
    const q = (req.query.q || '').trim() || undefined;
    const category = (req.query.category || '').trim() || undefined;
    const tag = (req.query.tag || '').trim() || undefined;

    // Build query
    const query = publicDb('posts')
      .select(
        'posts.id',
        'posts.title',
        'posts.slug',
        'posts.excerpt',
        'posts.cover_image',
        'posts.category',
        'posts.reading_minutes',
        'posts.view_count',
        'posts.published_at'
      )
      .orderBy('published_at', 'desc');

    if (category) {
      query.whereRaw('LOWER(category) = ?', [category.toLowerCase()]);
    }

    if (q) {
      const like = `%${q}%`;
      query.where(function() {
        this.whereRaw('LOWER(title) LIKE ?', [like.toLowerCase()])
          .orWhereRaw('LOWER(excerpt) LIKE ?', [like.toLowerCase()])
          .orWhereRaw('LOWER(content) LIKE ?', [like.toLowerCase()]);
      });
    }

    if (tag) {
      query.whereIn('posts.id', 
        publicDb('post_tags')
          .select('post_id')
          .join('tags', 'post_tags.tag_id', 'tags.id')
          .whereRaw('LOWER(tags.name) = ?', [tag.toLowerCase()])
      );
    }

    // Execute paginated query
    const items = await query
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Attach tags to each post
    if (items.length > 0) {
      const postIds = items.map(p => p.id);
      const tagRows = await publicDb('post_tags')
        .select('post_id', 'tags.name')
        .join('tags', 'post_tags.tag_id', 'tags.id')
        .whereIn('post_id', postIds);

      const tagMap = {};
      tagRows.forEach(r => {
        (tagMap[r.post_id] = tagMap[r.post_id] || []).push(r.name);
      });

      items.forEach(post => {
        post.tags = tagMap[post.id] || [];
      });
    }

    if (!includeMeta) {
      return res.json(items);
    }

    // Get total count for pagination
    const countQuery = publicDb('posts').count({ count: '*' });
    if (category) countQuery.whereRaw('LOWER(category) = ?', [category.toLowerCase()]);
    if (q) {
      const like = `%${q}%`;
      countQuery.where(function() {
        this.whereRaw('LOWER(title) LIKE ?', [like.toLowerCase()])
          .orWhereRaw('LOWER(excerpt) LIKE ?', [like.toLowerCase()])
          .orWhereRaw('LOWER(content) LIKE ?', [like.toLowerCase()]);
      });
    }
    if (tag) {
      countQuery.whereIn('id',
        publicDb('post_tags')
          .select('post_id')
          .join('tags', 'post_tags.tag_id', 'tags.id')
          .whereRaw('LOWER(tags.name) = ?', [tag.toLowerCase()])
      );
    }

    const [{ count }] = await countQuery;
    const total = Number(count) || 0;

    res.json({
      page,
      pageSize,
      total,
      hasMore: page * pageSize < total,
      data: items
    });

  } catch (error) {
    console.error('Error fetching public posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  }
}

/**
 * Get single post by slug from public database
 * No authentication required
 */
async function getPublicBySlug(req, res) {
  try {
    const { slug } = req.params;

    const post = await publicDb('posts')
      .where({ slug })
      .first();

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get tags
    const tags = await publicDb('post_tags')
      .select('tags.name')
      .join('tags', 'post_tags.tag_id', 'tags.id')
      .where({ 'post_tags.post_id': post.id });

    post.tags = tags.map(t => t.name);

    // Increment view count (best-effort, don't block response)
    publicDb('posts')
      .where({ id: post.id })
      .increment('view_count', 1)
      .catch(() => {}); // Ignore errors

    res.json(post);

  } catch (error) {
    console.error('Error fetching public post:', error);
    res.status(500).json({ message: 'Failed to fetch post' });
  }
}

/**
 * Get available categories from public database
 */
async function getPublicCategories(req, res) {
  try {
    const categories = await publicDb('posts')
      .distinct('category')
      .whereNotNull('category')
      .orderBy('category', 'asc');

    res.json(categories.map(c => c.category));

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
}

/**
 * Get popular tags from public database
 */
async function getPublicTags(req, res) {
  try {
    const limit = parseInt(req.query.limit || '20', 10);

    const tags = await publicDb('tags')
      .select('tags.name')
      .join('post_tags', 'tags.id', 'post_tags.tag_id')
      .groupBy('tags.id', 'tags.name')
      .count({ count: 'post_tags.post_id' })
      .orderBy('count', 'desc')
      .limit(limit);

    res.json(tags.map(t => ({ name: t.name, count: t.count })));

  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Failed to fetch tags' });
  }
}

module.exports = {
  listPublic,
  getPublicBySlug,
  getPublicCategories,
  getPublicTags
};
