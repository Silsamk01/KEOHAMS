/**
 * Feature 13: Affiliate System Enhancements
 * - Click tracking
 * - Conversion tracking
 * - Custom commission rates
 * - Performance analytics
 * - Withdrawal history
 */
exports.up = async function (knex) {
  // Create affiliate_clicks table
  if (!(await knex.schema.hasTable('affiliate_clicks'))) {
    await knex.schema.createTable('affiliate_clicks', (table) => {
      table.increments('id').primary();
      table.integer('affiliate_id').unsigned().notNullable()
        .references('id').inTable('affiliates').onDelete('CASCADE');
      table.string('referral_code', 50).notNullable();
      table.string('ip_address', 45).nullable();
      table.text('user_agent').nullable();
      table.string('referrer_url', 500).nullable();
      table.string('landing_page', 500).nullable();
      table.integer('referred_user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.string('session_id', 100).nullable();
      table.timestamp('clicked_at').defaultTo(knex.fn.now());
      
      table.index('affiliate_id');
      table.index('referral_code');
      table.index('referred_user_id');
      table.index('clicked_at');
    });
  }

  // Create affiliate_conversions table
  if (!(await knex.schema.hasTable('affiliate_conversions'))) {
    await knex.schema.createTable('affiliate_conversions', (table) => {
      table.increments('id').primary();
      table.integer('affiliate_id').unsigned().notNullable()
        .references('id').inTable('affiliates').onDelete('CASCADE');
      table.integer('click_id').unsigned().nullable()
        .references('id').inTable('affiliate_clicks').onDelete('SET NULL');
      table.integer('order_id').unsigned().notNullable()
        .references('id').inTable('orders').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.decimal('order_amount', 10, 2).notNullable();
      table.decimal('commission_amount', 10, 2).notNullable();
      table.decimal('commission_rate', 5, 2).notNullable(); // Percentage
      table.enum('status', ['PENDING', 'APPROVED', 'REJECTED', 'PAID']).defaultTo('PENDING');
      table.text('rejection_reason').nullable();
      table.timestamp('approved_at').nullable();
      table.timestamp('paid_at').nullable();
      table.timestamps(true, true);
      
      table.index('affiliate_id');
      table.index('order_id');
      table.index('user_id');
      table.index('status');
      table.index(['affiliate_id', 'status']);
    });
  }

  // Create custom_commission_rates table
  if (!(await knex.schema.hasTable('custom_commission_rates'))) {
    await knex.schema.createTable('custom_commission_rates', (table) => {
      table.increments('id').primary();
      table.integer('affiliate_id').unsigned().notNullable()
        .references('id').inTable('affiliates').onDelete('CASCADE');
      table.enum('rate_type', ['PRODUCT', 'CATEGORY', 'GLOBAL']).notNullable();
      table.integer('product_id').unsigned().nullable()
        .references('id').inTable('products').onDelete('CASCADE');
      table.integer('category_id').unsigned().nullable()
        .references('id').inTable('categories').onDelete('CASCADE');
      table.decimal('commission_rate', 5, 2).notNullable(); // Percentage
      table.boolean('is_active').defaultTo(true);
      table.date('valid_from').nullable();
      table.date('valid_until').nullable();
      table.integer('created_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      
      table.index('affiliate_id');
      table.index('product_id');
      table.index('category_id');
      table.index(['affiliate_id', 'is_active']);
    });
  }

  // Create affiliate_withdrawals table
  if (!(await knex.schema.hasTable('affiliate_withdrawals'))) {
    await knex.schema.createTable('affiliate_withdrawals', (table) => {
      table.increments('id').primary();
      table.integer('affiliate_id').unsigned().notNullable()
        .references('id').inTable('affiliates').onDelete('CASCADE');
      table.decimal('amount', 10, 2).notNullable();
      table.enum('method', ['BANK_TRANSFER', 'PAYPAL', 'PAYSTACK', 'MOBILE_MONEY']).notNullable();
      table.json('payment_details').nullable(); // Bank info, PayPal email, etc.
      table.enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED']).defaultTo('PENDING');
      table.text('rejection_reason').nullable();
      table.string('transaction_reference', 100).nullable();
      table.integer('processed_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('processed_at').nullable();
      table.timestamps(true, true);
      
      table.index('affiliate_id');
      table.index('status');
      table.index(['affiliate_id', 'status']);
    });
  }

  // Add performance metrics to affiliates table
  if (await knex.schema.hasTable('affiliates')) {
    const hasClickCount = await knex.schema.hasColumn('affiliates', 'total_clicks');
    const hasConversionCount = await knex.schema.hasColumn('affiliates', 'total_conversions');
    const hasConversionRate = await knex.schema.hasColumn('affiliates', 'conversion_rate');

    if (!hasClickCount) {
      await knex.schema.table('affiliates', (table) => {
        table.integer('total_clicks').unsigned().defaultTo(0);
      });
    }

    if (!hasConversionCount) {
      await knex.schema.table('affiliates', (table) => {
        table.integer('total_conversions').unsigned().defaultTo(0);
      });
    }

    if (!hasConversionRate) {
      await knex.schema.table('affiliates', (table) => {
        table.decimal('conversion_rate', 5, 2).defaultTo(0);
      });
    }
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasTable('affiliates')) {
    await knex.schema.table('affiliates', (table) => {
      table.dropColumn('total_clicks');
      table.dropColumn('total_conversions');
      table.dropColumn('conversion_rate');
    });
  }

  await knex.schema.dropTableIfExists('affiliate_withdrawals');
  await knex.schema.dropTableIfExists('custom_commission_rates');
  await knex.schema.dropTableIfExists('affiliate_conversions');
  await knex.schema.dropTableIfExists('affiliate_clicks');
};
