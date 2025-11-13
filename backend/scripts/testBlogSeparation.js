/**
 * Test Blog Separation
 * Verifies dual database setup and sync functionality
 * Run: node scripts/testBlogSeparation.js
 */
require('dotenv').config();
const db = require('../src/config/db');
const publicDb = require('../src/config/publicDb');
const blogSyncService = require('../src/services/blogSyncService');

async function testBlogSeparation() {
  console.log('🧪 Testing Blog Separation System\n');

  try {
    // Test 1: Database Connections
    console.log('Test 1: Database Connections');
    await db.raw('SELECT 1');
    console.log('  ✓ Main database connected');
    
    await publicDb.raw('SELECT 1');
    console.log('  ✓ Public blog database connected\n');

    // Test 2: Check Main Database
    console.log('Test 2: Main Database Content');
    const [mainStats] = await db('posts')
      .count({ total: '*' })
      .count({ published: db.raw("CASE WHEN status = 'PUBLISHED' THEN 1 END") });
    console.log(`  Total posts: ${mainStats.total}`);
    console.log(`  Published: ${mainStats.published}\n`);

    // Test 3: Check Public Database
    console.log('Test 3: Public Database Content');
    const [publicStats] = await publicDb('posts').count({ count: '*' });
    console.log(`  Public posts: ${publicStats.count}\n`);

    // Test 4: Sync Statistics
    console.log('Test 4: Sync Statistics');
    const syncStats = await blogSyncService.getSyncStats();
    console.log(`  Main published: ${syncStats.main_published}`);
    console.log(`  Public total: ${syncStats.public_total}`);
    console.log(`  In sync: ${syncStats.in_sync ? '✓ Yes' : '✗ No'}\n`);

    // Test 5: Recent Sync Activity
    console.log('Test 5: Recent Sync Activity');
    const recentSyncs = await publicDb('sync_log')
      .orderBy('synced_at', 'desc')
      .limit(5);
    
    if (recentSyncs.length === 0) {
      console.log('  ⚠ No sync activity yet (run initial sync)\n');
    } else {
      console.log(`  Last ${recentSyncs.length} syncs:`);
      recentSyncs.forEach(sync => {
        const date = new Date(sync.synced_at).toLocaleString();
        console.log(`    - Post ${sync.post_id}: ${sync.action} at ${date}`);
      });
      console.log('');
    }

    // Test 6: Sample Post Comparison
    console.log('Test 6: Sample Post Verification');
    const mainPost = await db('posts')
      .where({ status: 'PUBLISHED' })
      .first();
    
    if (mainPost) {
      const publicPost = await publicDb('posts')
        .where({ id: mainPost.id })
        .first();
      
      if (publicPost) {
        console.log(`  ✓ Post "${mainPost.title}" exists in both databases`);
        console.log(`    Main: ${mainPost.slug}`);
        console.log(`    Public: ${publicPost.slug}`);
        console.log(`    Views: ${publicPost.view_count || 0}\n`);
      } else {
        console.log(`  ⚠ Post "${mainPost.title}" not synced to public database`);
        console.log(`    Recommendation: Run sync for post ID ${mainPost.id}\n`);
      }
    } else {
      console.log('  ⚠ No published posts in main database\n');
    }

    // Test 7: Database Structure Verification
    console.log('Test 7: Database Structure');
    const publicTables = await publicDb.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ?
      ORDER BY table_name
    `, [process.env.PUBLIC_DB_NAME || 'keohams_public_blog']);
    
    const expectedTables = ['comments', 'post_tags', 'posts', 'sync_log', 'tags'];
    const actualTables = publicTables[0].map(t => t.table_name);
    
    expectedTables.forEach(table => {
      if (actualTables.includes(table)) {
        console.log(`  ✓ Table '${table}' exists`);
      } else {
        console.log(`  ✗ Table '${table}' missing!`);
      }
    });
    console.log('');

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 Summary');
    console.log('═'.repeat(50));
    
    const issues = [];
    
    if (syncStats.main_published !== syncStats.public_total) {
      issues.push(`Sync mismatch: ${syncStats.main_published} main vs ${syncStats.public_total} public`);
    }
    
    if (mainStats.published > 0 && publicStats.count === 0) {
      issues.push('Published posts exist but public DB is empty');
    }
    
    if (issues.length === 0) {
      console.log('✅ All tests passed!');
      console.log('   Blog separation is working correctly.\n');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      console.log('\n💡 Recommendation: Run initial sync');
      console.log('   POST /api/blog/admin/sync/all\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close connections
    await db.destroy();
    await publicDb.destroy();
  }
}

testBlogSeparation();
