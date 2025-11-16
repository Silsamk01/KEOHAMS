/**
 * Migration: Add Email-based 2FA
 * Adds support for email-based two-factor authentication as an alternative to TOTP
 */

exports.up = async function(knex) {
  // Add email 2FA fields to users table
  await knex.schema.table('users', (table) => {
    table.boolean('email_2fa_enabled').defaultTo(false).after('twofa_secret');
    table.string('email_2fa_method', 20).nullable().comment('totp or email').after('email_2fa_enabled');
  });

  // Create table for email 2FA codes
  await knex.schema.createTable('email_2fa_codes', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('code', 10).notNullable();
    table.string('purpose', 20).notNullable().comment('login or verification');
    table.boolean('used').defaultTo(false);
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);
    
    table.index(['user_id', 'code']);
    table.index('expires_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_2fa_codes');
  
  await knex.schema.table('users', (table) => {
    table.dropColumn('email_2fa_enabled');
    table.dropColumn('email_2fa_method');
  });
};
