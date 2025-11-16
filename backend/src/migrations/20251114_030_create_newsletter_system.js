/**
 * Migration: Newsletter System
 * Creates tables for newsletter subscribers and campaigns
 */

exports.up = async function(knex) {
  // Newsletter subscribers table
  await knex.schema.createTable('newsletter_subscribers', (table) => {
    table.increments('id').primary();
    table.string('email', 255).notNullable().unique();
    table.string('name', 255).nullable();
    table.enum('status', ['ACTIVE', 'UNSUBSCRIBED', 'BOUNCED']).defaultTo('ACTIVE');
    table.string('subscription_token', 64).nullable().unique();
    table.string('source', 50).nullable().comment('Where they subscribed from');
    table.timestamp('subscribed_at').defaultTo(knex.fn.now());
    table.timestamp('unsubscribed_at').nullable();
    table.timestamps(true, true);
    
    table.index('email');
    table.index('status');
  });

  // Newsletter campaigns table
  await knex.schema.createTable('newsletter_campaigns', (table) => {
    table.increments('id').primary();
    table.string('subject', 255).notNullable();
    table.text('content').notNullable();
    table.text('plain_text').nullable();
    table.enum('status', ['DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED']).defaultTo('DRAFT');
    table.integer('admin_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('scheduled_at').nullable();
    table.timestamp('sent_at').nullable();
    table.integer('total_recipients').defaultTo(0);
    table.integer('sent_count').defaultTo(0);
    table.integer('failed_count').defaultTo(0);
    table.timestamps(true, true);
    
    table.index('status');
    table.index('scheduled_at');
  });

  // Newsletter campaign logs
  await knex.schema.createTable('newsletter_logs', (table) => {
    table.increments('id').primary();
    table.integer('campaign_id').unsigned().notNullable().references('id').inTable('newsletter_campaigns').onDelete('CASCADE');
    table.integer('subscriber_id').unsigned().nullable().references('id').inTable('newsletter_subscribers').onDelete('SET NULL');
    table.string('email', 255).notNullable();
    table.enum('status', ['SENT', 'FAILED', 'BOUNCED']).notNullable();
    table.text('error_message').nullable();
    table.timestamp('sent_at').defaultTo(knex.fn.now());
    
    table.index('campaign_id');
    table.index('subscriber_id');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('newsletter_logs');
  await knex.schema.dropTableIfExists('newsletter_campaigns');
  await knex.schema.dropTableIfExists('newsletter_subscribers');
};
