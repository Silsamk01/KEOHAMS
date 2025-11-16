/**
 * Migration: Enhanced Order Management System
 * Adds comprehensive order workflow, shipping, tracking, and fulfillment
 */

exports.up = async function(knex) {
  // Update orders table status enum to include more granular statuses
  await knex.raw(`
    ALTER TABLE orders 
    MODIFY COLUMN status ENUM(
      'PENDING',
      'AWAITING_PAYMENT',
      'PAYMENT_FAILED',
      'PAID',
      'PROCESSING',
      'AWAITING_SHIPMENT',
      'SHIPPED',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'CANCELLED',
      'REFUNDED',
      'ON_HOLD',
      'PARTIALLY_SHIPPED'
    ) DEFAULT 'PENDING'
  `);

  // Add shipping and tracking fields to orders
  const hasShippingAddress = await knex.schema.hasColumn('orders', 'shipping_address');
  if (!hasShippingAddress) {
    await knex.schema.table('orders', (t) => {
      t.json('shipping_address').nullable().comment('Shipping address details');
      t.json('billing_address').nullable().comment('Billing address details');
      t.string('shipping_method', 100).nullable();
      t.decimal('shipping_cost', 12, 2).defaultTo(0);
      t.string('tracking_number', 100).nullable();
      t.string('carrier', 100).nullable();
      t.string('estimated_delivery_date', 50).nullable();
      t.timestamp('shipped_at').nullable();
      t.timestamp('delivered_at').nullable();
      t.text('cancellation_reason').nullable();
      t.timestamp('cancelled_at').nullable();
      t.integer('cancelled_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.text('admin_notes').nullable();
      t.text('customer_notes').nullable();
    });
  }

  // Order Status History table
  await knex.schema.createTableIfNotExists('order_status_history', (t) => {
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('from_status', 50).nullable();
    t.string('to_status', 50).notNullable();
    t.integer('changed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.enum('changed_by_type', ['CUSTOMER', 'ADMIN', 'SYSTEM']).defaultTo('SYSTEM');
    t.text('notes').nullable();
    t.json('metadata').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    
    t.index('order_id');
    t.index('to_status');
    t.index('created_at');
  });

  // Order Shipments table (for split shipments)
  await knex.schema.createTableIfNotExists('order_shipments', (t) => {
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('shipment_reference', 100).notNullable().unique();
    t.enum('status', ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']).defaultTo('PREPARING');
    t.string('tracking_number', 100).nullable();
    t.string('carrier', 100).nullable();
    t.decimal('weight', 10, 2).nullable().comment('Weight in kg');
    t.json('dimensions').nullable().comment('Length, width, height in cm');
    t.json('items').notNullable().comment('Array of order_item_ids in this shipment');
    t.timestamp('shipped_at').nullable();
    t.timestamp('delivered_at').nullable();
    t.text('notes').nullable();
    t.timestamps(true, true);
    
    t.index('order_id');
    t.index('status');
    t.index('tracking_number');
  });

  // Order Returns/Refunds table
  await knex.schema.createTableIfNotExists('order_returns', (t) => {
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('return_reference', 100).notNullable().unique();
    t.enum('type', ['RETURN', 'EXCHANGE', 'REFUND']).notNullable();
    t.enum('reason', [
      'DEFECTIVE',
      'WRONG_ITEM',
      'NOT_AS_DESCRIBED',
      'DAMAGED_IN_SHIPPING',
      'CHANGED_MIND',
      'LATE_DELIVERY',
      'OTHER'
    ]).notNullable();
    t.text('description').notNullable();
    t.json('items').notNullable().comment('Array of {order_item_id, quantity, reason}');
    t.enum('status', ['REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'INSPECTING', 'COMPLETED', 'CANCELLED']).defaultTo('REQUESTED');
    t.decimal('refund_amount', 12, 2).defaultTo(0);
    t.json('images').nullable().comment('URLs of product images for return');
    t.text('admin_notes').nullable();
    t.text('rejection_reason').nullable();
    t.integer('processed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('approved_at').nullable();
    t.timestamp('completed_at').nullable();
    t.timestamps(true, true);
    
    t.index('order_id');
    t.index('user_id');
    t.index('status');
    t.index('type');
  });

  // Order Invoices table
  await knex.schema.createTableIfNotExists('order_invoices', (t) => {
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.string('invoice_number', 100).notNullable().unique();
    t.enum('type', ['INVOICE', 'RECEIPT', 'CREDIT_NOTE']).defaultTo('INVOICE');
    t.decimal('subtotal', 12, 2).notNullable();
    t.decimal('tax', 12, 2).defaultTo(0);
    t.decimal('shipping', 12, 2).defaultTo(0);
    t.decimal('discount', 12, 2).defaultTo(0);
    t.decimal('total', 12, 2).notNullable();
    t.string('currency', 3).defaultTo('NGN');
    t.json('items').notNullable().comment('Detailed line items');
    t.string('pdf_url', 500).nullable().comment('URL to generated PDF');
    t.enum('status', ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).defaultTo('DRAFT');
    t.timestamp('due_date').nullable();
    t.timestamp('sent_at').nullable();
    t.timestamp('paid_at').nullable();
    t.timestamps(true, true);
    
    t.index('order_id');
    t.index('invoice_number');
    t.index('status');
  });

  // Order Notes table (internal admin notes)
  await knex.schema.createTableIfNotExists('order_notes', (t) => {
    t.increments('id').primary();
    t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
    t.integer('created_by').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('note').notNullable();
    t.boolean('customer_visible').defaultTo(false);
    t.timestamps(true, true);
    
    t.index('order_id');
    t.index('created_by');
  });

  // Add fulfillment fields to order_items
  const hasOrderItemsFulfillment = await knex.schema.hasColumn('order_items', 'quantity_shipped');
  if (!hasOrderItemsFulfillment) {
    await knex.schema.table('order_items', (t) => {
      t.integer('quantity_shipped').defaultTo(0);
      t.integer('quantity_cancelled').defaultTo(0);
      t.integer('quantity_returned').defaultTo(0);
      t.enum('fulfillment_status', ['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED']).defaultTo('PENDING');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.table('order_items', (t) => {
    t.dropColumn('quantity_shipped');
    t.dropColumn('quantity_cancelled');
    t.dropColumn('quantity_returned');
    t.dropColumn('fulfillment_status');
  });

  await knex.schema.dropTableIfExists('order_notes');
  await knex.schema.dropTableIfExists('order_invoices');
  await knex.schema.dropTableIfExists('order_returns');
  await knex.schema.dropTableIfExists('order_shipments');
  await knex.schema.dropTableIfExists('order_status_history');

  await knex.schema.table('orders', (t) => {
    t.dropColumn('shipping_address');
    t.dropColumn('billing_address');
    t.dropColumn('shipping_method');
    t.dropColumn('shipping_cost');
    t.dropColumn('tracking_number');
    t.dropColumn('carrier');
    t.dropColumn('estimated_delivery_date');
    t.dropColumn('shipped_at');
    t.dropColumn('delivered_at');
    t.dropColumn('cancellation_reason');
    t.dropColumn('cancelled_at');
    t.dropColumn('cancelled_by');
    t.dropColumn('admin_notes');
    t.dropColumn('customer_notes');
  });

  await knex.raw(`
    ALTER TABLE orders 
    MODIFY COLUMN status VARCHAR(255) DEFAULT 'PENDING'
  `);
};
