/**
 * Initial Blog Sync Script
 * Syncs all published posts from main DB to public DB
 * Run: node scripts/syncPublishedPosts.js
 */
require('dotenv').config();
const blogSyncService = require('../src/services/blogSyncService');

async function syncPublishedPosts() {
  console.log('🔄 Starting initial blog synchronization...\n');

  try {
    const result = await blogSyncService.syncAllPublished();
    
    console.log('\n✅ Synchronization complete!');
    console.log(`   Successfully synced: ${result.synced} posts`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.errors > 0) {
      console.log('\n⚠️  Some posts failed to sync. Check logs above for details.');
    }

    // Show final stats
    console.log('\n📊 Final Statistics:');
    const stats = await blogSyncService.getSyncStats();
    console.log(`   Main published: ${stats.main_published}`);
    console.log(`   Public total: ${stats.public_total}`);
    console.log(`   In sync: ${stats.in_sync ? '✓ Yes' : '✗ No'}`);

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncPublishedPosts();
