/**
 * Migration: Multi-Currency Support System
 * Adds currency management and conversion functionality
 */

exports.up = async function(knex) {
  // Create currencies table
  const hasCurrencies = await knex.schema.hasTable('currencies');
  if (!hasCurrencies) {
    await knex.schema.createTable('currencies', (table) => {
      table.increments('id').primary();
      table.string('code', 3).notNullable().unique().comment('ISO 4217 currency code');
      table.string('name', 100).notNullable();
      table.string('symbol', 10).notNullable();
      table.decimal('exchange_rate', 12, 6).notNullable().defaultTo(1);
      table.boolean('is_default').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamp('rate_updated_at').defaultTo(knex.fn.now());
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('code');
      table.index('is_default');
    });
  }

  // Create user_currency_preferences table
  const hasUserCurrencyPrefs = await knex.schema.hasTable('user_currency_preferences');
  if (!hasUserCurrencyPrefs) {
    await knex.schema.createTable('user_currency_preferences', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.integer('currency_id').unsigned().notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('currency_id').references('currencies.id').onDelete('CASCADE');
      
      table.unique('user_id');
    });
  }

  // Add currency_id to orders table
  const hasOrderCurrency = await knex.schema.hasColumn('orders', 'currency_id');
  if (!hasOrderCurrency) {
    await knex.schema.table('orders', (table) => {
      table.integer('currency_id').unsigned();
      table.string('currency_code', 3).defaultTo('USD');
      table.decimal('exchange_rate_used', 12, 6).defaultTo(1);
      
      table.foreign('currency_id').references('currencies.id').onDelete('SET NULL');
    });
  }

  // Insert default currencies
  const hasDefaultCurrencies = await knex('currencies').count('* as count').first();
  if (hasDefaultCurrencies.count === 0) {
    await knex('currencies').insert([
      { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1.0, is_default: true, is_active: true },
      { code: 'EUR', name: 'Euro', symbol: '€', exchange_rate: 0.92, is_active: true },
      { code: 'GBP', name: 'British Pound', symbol: '£', exchange_rate: 0.79, is_active: true },
      { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', exchange_rate: 1580.0, is_active: true },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', exchange_rate: 1.36, is_active: true },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', exchange_rate: 1.53, is_active: true }
    ]);
  }
};

exports.down = async function(knex) {
  const hasOrderCurrency = await knex.schema.hasColumn('orders', 'currency_id');
  if (hasOrderCurrency) {
    await knex.schema.table('orders', (table) => {
      table.dropForeign('currency_id');
      table.dropColumn('currency_id');
      table.dropColumn('currency_code');
      table.dropColumn('exchange_rate_used');
    });
  }

  await knex.schema.dropTableIfExists('user_currency_preferences');
  await knex.schema.dropTableIfExists('currencies');
};
