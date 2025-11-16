/**
 * Migration: Add platform_settings table for storing Paystack and other API keys
 * @param {import('knex').Knex} knex
 */
exports.up = async function(knex) {
  await knex.schema.createTable('platform_settings', (table) => {
    table.increments('id').primary();
    table.string('setting_key', 100).notNullable().unique();
    table.text('setting_value').nullable();
    table.boolean('is_encrypted').defaultTo(false);
    table.string('category', 50).nullable(); // e.g., 'payment', 'email', 'api'
    table.text('description').nullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('setting_key');
    table.index('category');
  });
  
  // Insert default Paystack settings (empty initially)
  await knex('platform_settings').insert([
    {
      setting_key: 'paystack_public_key',
      setting_value: '',
      is_encrypted: false,
      category: 'payment',
      description: 'Paystack Public/Publishable Key for frontend payment initialization'
    },
    {
      setting_key: 'paystack_secret_key',
      setting_value: '',
      is_encrypted: true,
      category: 'payment',
      description: 'Paystack Secret Key for backend payment verification (encrypted)'
    },
    {
      setting_key: 'paystack_enabled',
      setting_value: 'false',
      is_encrypted: false,
      category: 'payment',
      description: 'Enable/disable Paystack payment gateway'
    }
  ]);
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('platform_settings');
};
