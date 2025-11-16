/**
 * Migration: Analytics and Reporting System
 * Creates analytics tracking and reporting infrastructure
 */

exports.up = async function(knex) {
  // Create analytics_events table for tracking user actions
  const hasAnalyticsEvents = await knex.schema.hasTable('analytics_events');
  if (!hasAnalyticsEvents) {
    await knex.schema.createTable('analytics_events', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned();
      table.string('session_id', 100);
      table.enum('event_type', [
        'PAGE_VIEW',
        'PRODUCT_VIEW',
        'ADD_TO_CART',
        'REMOVE_FROM_CART',
        'CHECKOUT_START',
        'CHECKOUT_COMPLETE',
        'PURCHASE',
        'SEARCH',
        'CLICK',
        'REGISTRATION',
        'LOGIN',
        'LOGOUT'
      ]).notNullable();
      table.string('event_name', 255);
      table.json('event_data').comment('Additional event metadata');
      table.string('page_url', 500);
      table.string('referrer', 500);
      table.string('user_agent', 500);
      table.string('ip_address', 45);
      table.string('country', 100);
      table.string('city', 100);
      table.string('device_type', 50).comment('mobile, desktop, tablet');
      table.string('browser', 100);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      
      table.index(['user_id', 'created_at']);
      table.index(['session_id', 'created_at']);
      table.index('event_type');
      table.index('created_at');
    });
  }

  // Create conversion_funnel table for tracking checkout steps
  const hasConversionFunnel = await knex.schema.hasTable('conversion_funnel');
  if (!hasConversionFunnel) {
    await knex.schema.createTable('conversion_funnel', (table) => {
      table.increments('id').primary();
      table.string('session_id', 100).notNullable();
      table.integer('user_id').unsigned();
      table.enum('step', [
        'PRODUCT_VIEW',
        'ADD_TO_CART',
        'CART_VIEW',
        'CHECKOUT_START',
        'SHIPPING_INFO',
        'PAYMENT_INFO',
        'ORDER_COMPLETE'
      ]).notNullable();
      table.integer('product_id').unsigned();
      table.integer('cart_id').unsigned();
      table.integer('order_id').unsigned();
      table.decimal('cart_value', 12, 2);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.foreign('product_id').references('products.id').onDelete('SET NULL');
      table.foreign('order_id').references('orders.id').onDelete('SET NULL');
      
      table.index(['session_id', 'created_at']);
      table.index(['user_id', 'created_at']);
      table.index('step');
    });
  }

  // Create daily_metrics table for aggregated daily statistics
  const hasDailyMetrics = await knex.schema.hasTable('daily_metrics');
  if (!hasDailyMetrics) {
    await knex.schema.createTable('daily_metrics', (table) => {
      table.increments('id').primary();
      table.date('metric_date').notNullable().unique();
      table.integer('total_revenue').defaultTo(0);
      table.integer('total_orders').defaultTo(0);
      table.integer('total_customers').defaultTo(0);
      table.integer('new_customers').defaultTo(0);
      table.integer('total_products_sold').defaultTo(0);
      table.decimal('average_order_value', 12, 2).defaultTo(0);
      table.integer('total_visitors').defaultTo(0);
      table.integer('total_page_views').defaultTo(0);
      table.decimal('conversion_rate', 5, 2).defaultTo(0).comment('Percentage');
      table.integer('cart_abandonment_count').defaultTo(0);
      table.integer('support_tickets_created').defaultTo(0);
      table.integer('affiliate_signups').defaultTo(0);
      table.integer('total_commission_paid').defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('metric_date');
    });
  }

  // Create product_performance table for product analytics
  const hasProductPerformance = await knex.schema.hasTable('product_performance');
  if (!hasProductPerformance) {
    await knex.schema.createTable('product_performance', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.date('metric_date').notNullable();
      table.integer('views').defaultTo(0);
      table.integer('add_to_cart').defaultTo(0);
      table.integer('purchases').defaultTo(0);
      table.integer('revenue').defaultTo(0);
      table.integer('units_sold').defaultTo(0);
      table.decimal('conversion_rate', 5, 2).defaultTo(0);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      
      table.unique(['product_id', 'metric_date']);
      table.index('metric_date');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('product_performance');
  await knex.schema.dropTableIfExists('daily_metrics');
  await knex.schema.dropTableIfExists('conversion_funnel');
  await knex.schema.dropTableIfExists('analytics_events');
};
