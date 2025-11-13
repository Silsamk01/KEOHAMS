/**
 * Blog Sync Service
 * Syncs published blog posts from main DB to public DB
 * Admin controls content in main DB, public sees synced content
 */
const db = require('../config/db'); // Main database
const publicDb = require('../config/publicDb'); // Public blog database

class BlogSyncService {
  /**
   * Sync a single post to public database
   * @param {number} postId - Post ID from main database
   * @param {string} action - 'publish' or 'unpublish'
   */
  async syncPost(postId, action = 'publish') {
    try {
      if (action === 'unpublish') {
        // Remove from public database
        await this.removePostFromPublic(postId);
        return { success: true, action: 'removed' };
      }

      // Get post from main database
      const post = await db('posts')
        .where({ id: postId, status: 'PUBLISHED' })
        .first();

      if (!post) {
        console.log(`Post ${postId} not found or not published, skipping sync`);
        return { success: false, reason: 'not_published' };
      }

      // Get tags
      const tags = await db('post_tags')
        .select('tags.id', 'tags.name')
        .join('tags', 'post_tags.tag_id', 'tags.id')
        .where({ 'post_tags.post_id': postId });

      // Prepare public post data (only public-safe fields)
      const publicPost = {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        cover_image: post.cover_image,
        category: post.category,
        reading_minutes: post.reading_minutes,
        view_count: post.view_count || 0,
        seo_title: post.seo_title,
        seo_description: post.seo_description,
        published_at: post.published_at,
        synced_at: new Date()
      };

      // Check if post exists in public DB
      const existingPost = await publicDb('posts').where({ id: postId }).first();

      if (existingPost) {
        // Update existing post
        await publicDb('posts').where({ id: postId }).update(publicPost);
        console.log(`✓ Updated post ${postId} in public database`);
      } else {
        // Insert new post
        await publicDb('posts').insert(publicPost);
        console.log(`✓ Inserted post ${postId} into public database`);
      }

      // Sync tags
      await this.syncTags(postId, tags);

      // Log sync action
      await publicDb('sync_log').insert({
        post_id: postId,
        action: existingPost ? 'UPDATE' : 'INSERT',
        synced_at: new Date()
      });

      return { success: true, action: existingPost ? 'updated' : 'created' };

    } catch (error) {
      console.error(`Error syncing post ${postId}:`, error);
      throw error;
    }
  }

  /**
   * Sync tags for a post
   */
  async syncTags(postId, tags) {
    if (!tags || tags.length === 0) {
      // Remove all tags for this post in public DB
      await publicDb('post_tags').where({ post_id: postId }).del();
      return;
    }

    // Ensure tags exist in public DB
    for (const tag of tags) {
      const existingTag = await publicDb('tags').where({ id: tag.id }).first();
      if (!existingTag) {
        await publicDb('tags').insert({ id: tag.id, name: tag.name });
      }
    }

    // Get current tag associations in public DB
    const currentTags = await publicDb('post_tags')
      .where({ post_id: postId })
      .pluck('tag_id');

    const newTagIds = tags.map(t => t.id);

    // Remove tags no longer associated
    const toRemove = currentTags.filter(id => !newTagIds.includes(id));
    if (toRemove.length > 0) {
      await publicDb('post_tags')
        .where({ post_id: postId })
        .whereIn('tag_id', toRemove)
        .del();
    }

    // Add new tag associations
    const toAdd = newTagIds.filter(id => !currentTags.includes(id));
    if (toAdd.length > 0) {
      const insertData = toAdd.map(tag_id => ({ post_id: postId, tag_id }));
      await publicDb('post_tags').insert(insertData);
    }
  }

  /**
   * Remove post from public database
   */
  async removePostFromPublic(postId) {
    try {
      const deleted = await publicDb('posts').where({ id: postId }).del();
      
      if (deleted > 0) {
        await publicDb('sync_log').insert({
          post_id: postId,
          action: 'DELETE',
          synced_at: new Date()
        });
        console.log(`✓ Removed post ${postId} from public database`);
      }

      return { success: true, deleted };
    } catch (error) {
      console.error(`Error removing post ${postId} from public DB:`, error);
      throw error;
    }
  }

  /**
   * Sync all published posts (bulk sync)
   * Useful for initial migration or full resync
   */
  async syncAllPublished() {
    try {
      console.log('🔄 Starting bulk sync of all published posts...');

      const publishedPosts = await db('posts')
        .where({ status: 'PUBLISHED' })
        .select('id');

      let successCount = 0;
      let errorCount = 0;

      for (const post of publishedPosts) {
        try {
          await this.syncPost(post.id, 'publish');
          successCount++;
        } catch (error) {
          console.error(`Failed to sync post ${post.id}:`, error.message);
          errorCount++;
        }
      }

      console.log(`✅ Bulk sync complete: ${successCount} success, ${errorCount} errors`);
      return { success: true, synced: successCount, errors: errorCount };

    } catch (error) {
      console.error('Error during bulk sync:', error);
      throw error;
    }
  }

  /**
   * Get sync statistics
   */
  async getSyncStats() {
    try {
      const [mainPublished] = await db('posts')
        .where({ status: 'PUBLISHED' })
        .count({ count: '*' });

      const [publicTotal] = await publicDb('posts')
        .count({ count: '*' });

      const recentSyncs = await publicDb('sync_log')
        .orderBy('synced_at', 'desc')
        .limit(10);

      return {
        main_published: mainPublished.count,
        public_total: publicTotal.count,
        in_sync: mainPublished.count === publicTotal.count,
        recent_syncs: recentSyncs
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      throw error;
    }
  }
}

module.exports = new BlogSyncService();
