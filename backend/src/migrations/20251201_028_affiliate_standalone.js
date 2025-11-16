/**
 * Migration: Make Affiliates Standalone
 * Separates affiliate system from shop user accounts
 * Adds affiliate-specific authentication fields and makes user_id optional
 */

exports.up = async function(knex) {
  // Check if columns already exist
  const hasEmail = await knex.schema.hasColumn('affiliates', 'email');
  
  if (!hasEmail) {
    // Add affiliate-specific fields
    await knex.schema.table('affiliates', (t) => {
      t.string('email', 255).nullable().after('user_id');
      t.string('password_hash', 255).nullable().after('email');
      t.string('name', 255).nullable().after('password_hash');
      t.string('phone', 255).nullable().after('name');
      t.boolean('email_verified').defaultTo(false).after('phone');
      t.integer('token_version').defaultTo(1).after('email_verified');
      t.boolean('is_active_account').defaultTo(true).after('token_version');
      t.timestamp('email_verified_at').nullable().after('is_active_account');
      t.timestamp('deleted_at').nullable().after('email_verified_at');
      
      // Make user_id nullable (for standalone affiliates)
      t.integer('user_id').unsigned().nullable().alter();
      
      // Add indexes
      t.index('email');
      t.index('is_active_account');
    });
    
    // Add unique constraint on email (for standalone affiliates)
    // Note: We'll handle this in application logic since user_id can be null
    // and we want to allow same email for affiliate and user if they link later
  }
  
  // Create affiliate_verification_tokens table
  const hasTokensTable = await knex.schema.hasTable('affiliate_verification_tokens');
  if (!hasTokensTable) {
    await knex.schema.createTable('affiliate_verification_tokens', (t) => {
      t.increments('id').primary();
      t.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
      t.string('type').notNullable().comment('verify-email, password-reset');
      t.string('token').notNullable().unique();
      t.timestamp('expires_at').notNullable();
      t.timestamps(true, true);
      
      t.index('affiliate_id');
      t.index('token');
      t.index(['type', 'expires_at']);
    });
  }
};

exports.down = async function(knex) {
  // Drop affiliate_verification_tokens table
  await knex.schema.dropTableIfExists('affiliate_verification_tokens');
  
  // Remove added columns
  await knex.schema.table('affiliates', (t) => {
    t.dropColumn('email');
    t.dropColumn('password_hash');
    t.dropColumn('name');
    t.dropColumn('phone');
    t.dropColumn('email_verified');
    t.dropColumn('token_version');
    t.dropColumn('is_active_account');
    t.dropColumn('email_verified_at');
    t.dropColumn('deleted_at');
    
    // Make user_id required again
    t.integer('user_id').unsigned().notNullable().alter();
  });
};

