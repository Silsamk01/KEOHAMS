/**
 * Migration: Payment System
 * Creates tables for payment processing, transactions, and refunds
 */

exports.up = async function(knex) {
  // Payment Transactions table
  const hasPaymentTransactions = await knex.schema.hasTable('payment_transactions');
  if (!hasPaymentTransactions) {
    await knex.schema.createTable('payment_transactions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.integer('order_id').unsigned().nullable().references('id').inTable('orders').onDelete('SET NULL');
    t.integer('quotation_id').unsigned().nullable().references('id').inTable('quotations').onDelete('SET NULL');
    
    // Transaction details
    t.string('reference', 100).notNullable().unique().comment('Paystack transaction reference');
    t.decimal('amount', 15, 2).notNullable().comment('Amount in base currency');
    t.string('currency', 3).defaultTo('NGN').comment('Transaction currency');
    t.enum('status', ['PENDING', 'SUCCESS', 'FAILED', 'ABANDONED', 'REFUNDED', 'PARTIALLY_REFUNDED']).defaultTo('PENDING');
    t.enum('payment_method', ['CARD', 'BANK_TRANSFER', 'USSD', 'QR', 'MOBILE_MONEY', 'BANK_ACCOUNT']).nullable();
    
    // Paystack data
    t.string('paystack_reference', 100).nullable().comment('Paystack internal reference');
    t.string('authorization_code', 100).nullable().comment('For recurring payments');
    t.string('card_type', 50).nullable();
    t.string('card_last4', 4).nullable();
    t.string('bank', 100).nullable();
    t.string('channel', 50).nullable();
    
    // Customer details
    t.string('customer_email', 255).notNullable();
    t.string('customer_name', 255).nullable();
    t.string('ip_address', 45).nullable();
    
    // Metadata
    t.json('metadata').nullable().comment('Additional transaction data');
    t.text('error_message').nullable();
    t.timestamp('paid_at').nullable();
    t.timestamp('verified_at').nullable();
    
    t.timestamps(true, true);
    
    // Indexes
    t.index('user_id');
    t.index('order_id');
    t.index('quotation_id');
    t.index('reference');
    t.index('status');
    t.index('created_at');
  });
  }

  // Payment Refunds table
  const hasPaymentRefunds = await knex.schema.hasTable('payment_refunds');
  if (!hasPaymentRefunds) {
    await knex.schema.createTable('payment_refunds', (t) => {
    t.increments('id').primary();
    t.integer('transaction_id').unsigned().notNullable().references('id').inTable('payment_transactions').onDelete('CASCADE');
    t.integer('initiated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    
    t.string('refund_reference', 100).notNullable().unique();
    t.decimal('amount', 15, 2).notNullable().comment('Refund amount');
    t.string('currency', 3).defaultTo('NGN');
    t.enum('status', ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED']).defaultTo('PENDING');
    t.enum('reason', ['CUSTOMER_REQUEST', 'DUPLICATE_PAYMENT', 'FRAUDULENT', 'ORDER_CANCELLED', 'PRODUCT_NOT_AVAILABLE', 'OTHER']).notNullable();
    t.text('notes').nullable();
    
    // Paystack data
    t.string('paystack_refund_id').nullable();
    t.json('paystack_response').nullable();
    t.timestamp('processed_at').nullable();
    
    t.timestamps(true, true);
    
    t.index('transaction_id');
    t.index('status');
  });
  }

  // Payment Webhooks Log table
  const hasPaymentWebhooks = await knex.schema.hasTable('payment_webhooks');
  if (!hasPaymentWebhooks) {
    await knex.schema.createTable('payment_webhooks', (t) => {
    t.increments('id').primary();
    
    t.string('event_type', 100).notNullable().comment('Paystack event type');
    t.string('reference', 100).nullable();
    t.json('payload').notNullable().comment('Full webhook payload');
    t.enum('status', ['PENDING', 'PROCESSED', 'FAILED', 'IGNORED']).defaultTo('PENDING');
    t.text('error_message').nullable();
    t.string('ip_address', 45).nullable();
    t.timestamp('processed_at').nullable();
    
    t.timestamps(true, true);
    
    t.index('event_type');
    t.index('reference');
    t.index('status');
    t.index('created_at');
  });
  }

  // Saved Payment Methods table
  const hasSavedPaymentMethods = await knex.schema.hasTable('saved_payment_methods');
  if (!hasSavedPaymentMethods) {
    await knex.schema.createTable('saved_payment_methods', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    
    t.string('authorization_code', 100).notNullable().unique();
    t.string('card_type', 50).nullable();
    t.string('card_last4', 4).nullable();
    t.string('exp_month', 2).nullable();
    t.string('exp_year', 4).nullable();
    t.string('bank', 100).nullable();
    t.string('card_bin', 6).nullable();
    t.boolean('is_default').defaultTo(false);
    t.boolean('is_active').defaultTo(true);
    
    t.timestamps(true, true);
    
    t.index('user_id');
    t.index('authorization_code');
  });
  }

  // Add payment fields to orders table if not exists
  const ordersHasPaymentFields = await knex.schema.hasColumn('orders', 'payment_transaction_id');
  if (!ordersHasPaymentFields) {
    await knex.schema.table('orders', (t) => {
      t.integer('payment_transaction_id').unsigned().nullable().references('id').inTable('payment_transactions').onDelete('SET NULL');
      t.enum('payment_status', ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).defaultTo('UNPAID');
      t.timestamp('paid_at').nullable();
    });
  }

  // Add payment fields to quotations table if not exists
  const quotationsHasPaymentFields = await knex.schema.hasColumn('quotations', 'payment_transaction_id');
  if (!quotationsHasPaymentFields) {
    await knex.schema.table('quotations', (t) => {
      t.integer('payment_transaction_id').unsigned().nullable().references('id').inTable('payment_transactions').onDelete('SET NULL');
      t.enum('payment_status', ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED']).defaultTo('UNPAID');
    });
  }
  
  // Check and add paid_at to quotations if not exists
  const quotationsHasPaidAt = await knex.schema.hasColumn('quotations', 'paid_at');
  if (!quotationsHasPaidAt) {
    await knex.schema.table('quotations', (t) => {
      t.timestamp('paid_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('quotations', (t) => {
    t.dropColumn('payment_transaction_id');
    t.dropColumn('payment_status');
    t.dropColumn('paid_at');
  });

  await knex.schema.table('orders', (t) => {
    t.dropColumn('payment_transaction_id');
    t.dropColumn('payment_status');
    t.dropColumn('paid_at');
  });

  await knex.schema.dropTableIfExists('saved_payment_methods');
  await knex.schema.dropTableIfExists('payment_webhooks');
  await knex.schema.dropTableIfExists('payment_refunds');
  await knex.schema.dropTableIfExists('payment_transactions');
};
