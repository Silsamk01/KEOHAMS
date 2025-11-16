/**
 * Migration: Email Marketing Automation System
 * Creates email campaigns, sequences, and automated workflow infrastructure
 */

exports.up = async function(knex) {
  // Create email_campaigns table
  const hasEmailCampaigns = await knex.schema.hasTable('email_campaigns');
  if (!hasEmailCampaigns) {
    await knex.schema.createTable('email_campaigns', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('subject', 255).notNullable();
      table.text('content').notNullable();
      table.enum('type', [
        'WELCOME',
        'ABANDONED_CART',
        'POST_PURCHASE',
        'RE_ENGAGEMENT',
        'PRODUCT_RECOMMENDATION',
        'NEWSLETTER',
        'PROMOTIONAL',
        'TRANSACTIONAL'
      ]).notNullable();
      table.enum('status', ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED']).defaultTo('DRAFT');
      table.json('audience_filter').comment('JSON filter criteria for recipients');
      table.timestamp('scheduled_at').nullable();
      table.integer('sent_count').defaultTo(0);
      table.integer('opened_count').defaultTo(0);
      table.integer('clicked_count').defaultTo(0);
      table.integer('converted_count').defaultTo(0);
      table.integer('created_by').unsigned();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('created_by').references('users.id').onDelete('SET NULL');
      
      table.index('type');
      table.index('status');
    });
  }

  // Create email_sequences table
  const hasEmailSequences = await knex.schema.hasTable('email_sequences');
  if (!hasEmailSequences) {
    await knex.schema.createTable('email_sequences', (table) => {
      table.increments('id').primary();
      table.integer('campaign_id').unsigned().notNullable();
      table.integer('sequence_order').notNullable();
      table.integer('delay_hours').notNullable().comment('Hours after previous email');
      table.string('subject', 255).notNullable();
      table.text('content').notNullable();
      table.boolean('active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('campaign_id').references('email_campaigns.id').onDelete('CASCADE');
      
      table.index(['campaign_id', 'sequence_order']);
    });
  }

  // Create email_logs table
  const hasEmailLogs = await knex.schema.hasTable('email_logs');
  if (!hasEmailLogs) {
    await knex.schema.createTable('email_logs', (table) => {
      table.increments('id').primary();
      table.integer('campaign_id').unsigned();
      table.integer('sequence_id').unsigned();
      table.integer('user_id').unsigned();
      table.string('email', 255).notNullable();
      table.string('subject', 255).notNullable();
      table.enum('status', ['PENDING', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'FAILED', 'BOUNCED']).defaultTo('PENDING');
      table.text('error_message');
      table.timestamp('sent_at').nullable();
      table.timestamp('opened_at').nullable();
      table.timestamp('clicked_at').nullable();
      table.string('tracking_id', 100).unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('campaign_id').references('email_campaigns.id').onDelete('SET NULL');
      table.foreign('sequence_id').references('email_sequences.id').onDelete('SET NULL');
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      
      table.index(['user_id', 'status']);
      table.index('campaign_id');
      table.index('tracking_id');
    });
  }

  // Create abandoned_carts table
  const hasAbandonedCarts = await knex.schema.hasTable('abandoned_carts');
  if (!hasAbandonedCarts) {
    await knex.schema.createTable('abandoned_carts', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned();
      table.string('session_id', 100);
      table.string('email', 255);
      table.json('cart_items').notNullable();
      table.decimal('cart_value', 12, 2).notNullable();
      table.integer('item_count').notNullable();
      table.enum('recovery_status', ['ABANDONED', 'REMINDED_1', 'REMINDED_2', 'REMINDED_3', 'RECOVERED']).defaultTo('ABANDONED');
      table.timestamp('abandoned_at').defaultTo(knex.fn.now());
      table.timestamp('first_reminder_at').nullable();
      table.timestamp('second_reminder_at').nullable();
      table.timestamp('third_reminder_at').nullable();
      table.timestamp('recovered_at').nullable();
      table.integer('recovered_order_id').unsigned();

      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.foreign('recovered_order_id').references('orders.id').onDelete('SET NULL');
      
      table.index(['user_id', 'recovery_status']);
      table.index('session_id');
      table.index('abandoned_at');
    });
  }

  // Create email_templates table
  const hasEmailTemplates = await knex.schema.hasTable('email_templates');
  if (!hasEmailTemplates) {
    await knex.schema.createTable('email_templates', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable().unique();
      table.string('subject', 255).notNullable();
      table.text('html_content').notNullable();
      table.text('text_content');
      table.json('variables').comment('Available template variables');
      table.enum('category', [
        'TRANSACTIONAL',
        'MARKETING',
        'SYSTEM',
        'NOTIFICATION'
      ]).defaultTo('MARKETING');
      table.boolean('active').defaultTo(true);
      table.integer('created_by').unsigned();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('created_by').references('users.id').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('email_templates');
  await knex.schema.dropTableIfExists('abandoned_carts');
  await knex.schema.dropTableIfExists('email_logs');
  await knex.schema.dropTableIfExists('email_sequences');
  await knex.schema.dropTableIfExists('email_campaigns');
};
