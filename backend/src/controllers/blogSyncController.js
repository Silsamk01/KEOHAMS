/**
 * Blog Sync Admin Controller
 * Admin endpoints to manually trigger syncs and view sync status
 */
const blogSyncService = require('../services/blogSyncService');

/**
 * Manually sync a specific post
 */
async function syncPost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const action = req.body.action || 'publish'; // 'publish' or 'unpublish'

    const result = await blogSyncService.syncPost(postId, action);
    
    res.json({
      message: `Post ${action === 'publish' ? 'synced' : 'removed'}`,
      ...result
    });

  } catch (error) {
    console.error('Error syncing post:', error);
    res.status(500).json({ message: 'Failed to sync post', error: error.message });
  }
}

/**
 * Bulk sync all published posts
 */
async function syncAll(req, res) {
  try {
    const result = await blogSyncService.syncAllPublished();
    
    res.json({
      message: 'Bulk sync completed',
      ...result
    });

  } catch (error) {
    console.error('Error during bulk sync:', error);
    res.status(500).json({ message: 'Failed to sync all posts', error: error.message });
  }
}

/**
 * Get sync statistics
 */
async function getSyncStats(req, res) {
  try {
    const stats = await blogSyncService.getSyncStats();
    
    res.json(stats);

  } catch (error) {
    console.error('Error getting sync stats:', error);
    res.status(500).json({ message: 'Failed to get sync stats', error: error.message });
  }
}

module.exports = {
  syncPost,
  syncAll,
  getSyncStats
};
