/**
 * Feature 12: Enhanced Notifications System
 * - Enhanced notification preferences
 * - SMS notifications support
 * - Real-time push notifications
 * - Notification templates
 */
exports.up = async function (knex) {
  // Create notification_preferences table
  if (!(await knex.schema.hasTable('notification_preferences'))) {
    await knex.schema.createTable('notification_preferences', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.enum('notification_type', [
        'ORDER_UPDATE',
        'PAYMENT_CONFIRMATION',
        'SHIPPING_UPDATE',
        'PRICE_DROP',
        'PRODUCT_RESTOCK',
        'SUPPORT_REPLY',
        'MARKETING',
        'NEWSLETTER',
        'REVIEW_REPLY',
        'WISHLIST_ALERT',
        'AFFILIATE_COMMISSION'
      ]).notNullable();
      table.boolean('email_enabled').defaultTo(true);
      table.boolean('sms_enabled').defaultTo(false);
      table.boolean('push_enabled').defaultTo(true);
      table.boolean('in_app_enabled').defaultTo(true);
      table.timestamps(true, true);
      
      table.unique(['user_id', 'notification_type']);
      table.index('user_id');
    });
  }

  // Create notification_templates table
  if (!(await knex.schema.hasTable('notification_templates'))) {
    await knex.schema.createTable('notification_templates', (table) => {
      table.increments('id').primary();
      table.string('template_key', 100).unique().notNullable();
      table.string('name', 200).notNullable();
      table.enum('channel', ['EMAIL', 'SMS', 'PUSH', 'IN_APP']).notNullable();
      table.string('subject', 200).nullable();
      table.text('body_template').notNullable(); // Supports {{variable}} placeholders
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      
      table.index('template_key');
      table.index('channel');
    });
  }

  // Create sms_logs table (track SMS sends)
  if (!(await knex.schema.hasTable('sms_logs'))) {
    await knex.schema.createTable('sms_logs', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.string('phone_number', 20).notNullable();
      table.text('message').notNullable();
      table.enum('status', ['PENDING', 'SENT', 'FAILED', 'DELIVERED']).defaultTo('PENDING');
      table.string('provider', 50).nullable(); // Twilio, Termii, etc.
      table.string('provider_message_id', 100).nullable();
      table.text('error_message').nullable();
      table.timestamp('sent_at').nullable();
      table.timestamp('delivered_at').nullable();
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('phone_number');
      table.index(['status', 'created_at']);
    });
  }

  // Add SMS phone number verification to users table
  if (await knex.schema.hasTable('users')) {
    const hasPhoneVerified = await knex.schema.hasColumn('users', 'phone_verified');
    const hasPhoneVerifiedAt = await knex.schema.hasColumn('users', 'phone_verified_at');

    if (!hasPhoneVerified) {
      await knex.schema.table('users', (table) => {
        table.boolean('phone_verified').defaultTo(false);
      });
    }

    if (!hasPhoneVerifiedAt) {
      await knex.schema.table('users', (table) => {
        table.timestamp('phone_verified_at').nullable();
      });
    }
  }

  // Enhance existing notifications table with priority and channels
  if (await knex.schema.hasTable('notifications')) {
    const hasPriority = await knex.schema.hasColumn('notifications', 'priority');
    const hasChannel = await knex.schema.hasColumn('notifications', 'channel');
    const hasActionUrl = await knex.schema.hasColumn('notifications', 'action_url');

    if (!hasPriority) {
      await knex.schema.table('notifications', (table) => {
        table.enum('priority', ['LOW', 'MEDIUM', 'HIGH', 'URGENT']).defaultTo('MEDIUM');
      });
    }

    if (!hasChannel) {
      await knex.schema.table('notifications', (table) => {
        table.enum('channel', ['IN_APP', 'EMAIL', 'SMS', 'PUSH']).defaultTo('IN_APP');
      });
    }

    if (!hasActionUrl) {
      await knex.schema.table('notifications', (table) => {
        table.string('action_url', 500).nullable();
      });
    }
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('notifications')) {
    await knex.schema.table('notifications', (table) => {
      table.dropColumn('priority');
      table.dropColumn('channel');
      table.dropColumn('action_url');
    });
  }

  if (await knex.schema.hasTable('users')) {
    await knex.schema.table('users', (table) => {
      table.dropColumn('phone_verified');
      table.dropColumn('phone_verified_at');
    });
  }

  await knex.schema.dropTableIfExists('sms_logs');
  await knex.schema.dropTableIfExists('notification_templates');
  await knex.schema.dropTableIfExists('notification_preferences');
};
