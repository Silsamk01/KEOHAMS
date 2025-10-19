const knex = require('knex');
const knexConfig = require('./knexfile');

const db = knex(knexConfig.development);

async function fixCorruptedMigration() {
  try {
    console.log('🔧 Fixing corrupted migration record...');
    
    // Check if the corrupted record exists
    const corruptedRecords = await db('knex_migrations')
      .where('name', '20251018021026_kyc_submissions.js')
      .select('*');
    
    if (corruptedRecords.length > 0) {
      console.log('📋 Found corrupted migration record:', corruptedRecords[0]);
      
      // Delete the corrupted record
      await db('knex_migrations')
        .where('name', '20251018021026_kyc_submissions.js')
        .delete();
      
      console.log('✅ Corrupted migration record deleted successfully!');
    } else {
      console.log('ℹ️  No corrupted migration record found.');
    }
    
    // Show recent migrations
    console.log('\n📊 Recent migrations:');
    const recentMigrations = await db('knex_migrations')
      .orderBy('id', 'desc')
      .limit(5)
      .select('*');
    
    recentMigrations.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.name} (batch: ${m.batch})`);
    });
    
    console.log('\n✅ Migration fix complete! You can now run: npm run migrate');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.destroy();
  }
}

fixCorruptedMigration();
