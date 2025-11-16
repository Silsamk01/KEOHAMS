/**
 * Affiliate System Migration
 * Creates tables for multi-level affiliate marketing with commission tracking
 */

exports.up = async function(knex) {
  // Affiliates table - extends users with affiliate-specific data
  await knex.schema.createTable('affiliates', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('referral_code', 20).notNullable().unique().comment('Unique referral code for the affiliate');
    t.integer('parent_affiliate_id').unsigned().nullable().references('id').inTable('affiliates').onDelete('SET NULL');
    t.decimal('total_earnings', 15, 2).defaultTo(0).comment('Total commissions earned');
    t.decimal('available_balance', 15, 2).defaultTo(0).comment('Available balance for withdrawal');
    t.decimal('pending_balance', 15, 2).defaultTo(0).comment('Pending commissions awaiting verification');
    t.integer('direct_referrals').defaultTo(0).comment('Number of direct referrals');
    t.integer('total_downline').defaultTo(0).comment('Total network size');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
    
    // Indexes
    t.index('user_id');
    t.index('parent_affiliate_id');
    t.index('referral_code');
    t.index(['is_active', 'created_at']);
  });

  // Affiliate Sales table - tracks sales made by affiliates
  await knex.schema.createTable('affiliate_sales', (t) => {
    t.increments('id').primary();
    t.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    t.integer('customer_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('sale_reference').notNullable().unique().comment('Unique reference for the sale');
    t.decimal('sale_amount', 15, 2).notNullable().comment('Total sale value');
    t.enum('payment_method', ['ONLINE', 'BANK_TRANSFER', 'CASH', 'OTHER']).notNullable();
    t.text('payment_details').nullable().comment('Payment proof/details');
    t.enum('verification_status', ['PENDING', 'VERIFIED', 'REJECTED']).defaultTo('PENDING');
    t.integer('verified_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('verified_at').nullable();
    t.text('verification_notes').nullable();
    t.boolean('commissions_paid').defaultTo(false).comment('Whether commissions have been distributed');
    t.timestamp('commissions_paid_at').nullable();
    t.timestamps(true, true);
    
    // Indexes
    t.index('affiliate_id');
    t.index('customer_id');
    t.index('sale_reference');
    t.index(['verification_status', 'created_at']);
    t.index(['commissions_paid', 'verification_status']);
  });

  // Commission Records table - tracks individual commission payments
  await knex.schema.createTable('commission_records', (t) => {
    t.increments('id').primary();
    t.integer('sale_id').unsigned().notNullable().references('id').inTable('affiliate_sales').onDelete('CASCADE');
    t.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    t.integer('level').notNullable().comment('0 = direct seller, 1+ = upline levels');
    t.decimal('commission_rate', 5, 2).notNullable().comment('Commission percentage applied');
    t.decimal('commission_amount', 15, 2).notNullable().comment('Commission amount earned');
    t.enum('status', ['PENDING', 'PAID', 'CANCELLED']).defaultTo('PENDING');
    t.timestamp('paid_at').nullable();
    t.timestamps(true, true);
    
    // Indexes
    t.index('sale_id');
    t.index('affiliate_id');
    t.index(['affiliate_id', 'status']);
    t.index(['level', 'status']);
    
    // Unique constraint to prevent duplicate commissions
    t.unique(['sale_id', 'affiliate_id', 'level']);
  });

  // Commission Settings table - configurable commission rates
  await knex.schema.createTable('commission_settings', (t) => {
    t.increments('id').primary();
    t.integer('level').notNullable().comment('Commission level (0 = direct, 1+ = upline)');
    t.decimal('rate', 5, 2).notNullable().comment('Commission rate percentage');
    t.decimal('max_total_rate', 5, 2).defaultTo(25.00).comment('Maximum total commission percentage');
    t.boolean('is_active').defaultTo(true);
    t.timestamps(true, true);
    
    t.unique('level');
  });

  // Insert default commission settings (3 levels max: direct + 2 upline)
  await knex('commission_settings').insert([
    { level: 0, rate: 10.00, is_active: true }, // Direct seller: 10%
    { level: 1, rate: 2.50, is_active: true }, // First upline: 2.5%
    { level: 2, rate: 2.50, is_active: true }  // Second upline: 2.5%
  ]);

  // Affiliate Withdrawals table - tracks payout requests
  await knex.schema.createTable('affiliate_withdrawals', (t) => {
    t.increments('id').primary();
    t.integer('affiliate_id').unsigned().notNullable().references('id').inTable('affiliates').onDelete('CASCADE');
    t.decimal('amount', 15, 2).notNullable();
    t.enum('method', ['BANK_TRANSFER', 'PAYPAL', 'MOBILE_MONEY', 'CRYPTO']).notNullable();
    t.json('payment_details').notNullable().comment('Bank account, PayPal email, etc.');
    t.enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED']).defaultTo('PENDING');
    t.integer('processed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('processed_at').nullable();
    t.text('processing_notes').nullable();
    t.string('transaction_reference').nullable();
    t.timestamps(true, true);
    
    // Indexes
    t.index('affiliate_id');
    t.index(['status', 'created_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('affiliate_withdrawals');
  await knex.schema.dropTableIfExists('commission_settings');
  await knex.schema.dropTableIfExists('commission_records');
  await knex.schema.dropTableIfExists('affiliate_sales');
  await knex.schema.dropTableIfExists('affiliates');
};