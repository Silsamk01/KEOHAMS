/**
 * Migration: Inventory Management System
 * Adds stock tracking, low stock alerts, reserved stock, and inventory history
 */

exports.up = async function(knex) {
  // Add inventory columns to products table (check each column individually)
  const hasQuantity = await knex.schema.hasColumn('products', 'quantity');
  const hasReservedQuantity = await knex.schema.hasColumn('products', 'reserved_quantity');
  const hasLowStockThreshold = await knex.schema.hasColumn('products', 'low_stock_threshold');
  const hasTrackInventory = await knex.schema.hasColumn('products', 'track_inventory');
  const hasSku = await knex.schema.hasColumn('products', 'sku');
  const hasBarcode = await knex.schema.hasColumn('products', 'barcode');
  const hasReorderPoint = await knex.schema.hasColumn('products', 'reorder_point');
  const hasReorderQuantity = await knex.schema.hasColumn('products', 'reorder_quantity');

  await knex.schema.table('products', (table) => {
    if (!hasQuantity) {
      table.integer('quantity').defaultTo(0).notNullable().comment('Current stock quantity');
    }
    if (!hasReservedQuantity) {
      table.integer('reserved_quantity').defaultTo(0).notNullable().comment('Stock reserved for pending orders');
    }
    if (!hasLowStockThreshold) {
      table.integer('low_stock_threshold').defaultTo(10).notNullable().comment('Alert threshold for low stock');
    }
    if (!hasTrackInventory) {
      table.boolean('track_inventory').defaultTo(true).comment('Whether to track inventory for this product');
    }
    if (!hasSku) {
      table.string('sku', 100).unique().comment('Stock keeping unit');
    }
    if (!hasBarcode) {
      table.string('barcode', 100).comment('Product barcode');
    }
    if (!hasReorderPoint) {
      table.integer('reorder_point').defaultTo(5).comment('Quantity at which to reorder');
    }
    if (!hasReorderQuantity) {
      table.integer('reorder_quantity').defaultTo(50).comment('Quantity to order when restocking');
    }
  });

  // Create inventory_history table for stock movement audit trail
  const hasInventoryHistory = await knex.schema.hasTable('inventory_history');
  if (!hasInventoryHistory) {
    await knex.schema.createTable('inventory_history', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.enum('type', [
        'PURCHASE',      // Stock received from supplier
        'SALE',          // Stock sold to customer
        'RETURN',        // Customer return (adds stock)
        'DAMAGE',        // Damaged/defective stock removed
        'ADJUSTMENT',    // Manual stock adjustment
        'RESERVATION',   // Stock reserved for order
        'RELEASE',       // Reserved stock released (cancelled order)
        'TRANSFER'       // Stock transfer between locations
      ]).notNullable();
      table.integer('quantity_change').notNullable().comment('Positive for additions, negative for removals');
      table.integer('quantity_before').notNullable();
      table.integer('quantity_after').notNullable();
      table.integer('reference_id').unsigned().comment('Order ID, return ID, etc.');
      table.string('reference_type', 50).comment('orders, returns, etc.');
      table.text('notes');
      table.integer('created_by').unsigned();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      table.foreign('created_by').references('users.id').onDelete('SET NULL');
      
      table.index(['product_id', 'created_at']);
      table.index(['reference_id', 'reference_type']);
      table.index('type');
    });
  }

  // Create stock_reservations table for cart/checkout reservations
  const hasStockReservations = await knex.schema.hasTable('stock_reservations');
  if (!hasStockReservations) {
    await knex.schema.createTable('stock_reservations', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('user_id').unsigned();
      table.integer('quantity').notNullable();
      table.enum('type', ['CART', 'CHECKOUT', 'ORDER']).notNullable();
      table.integer('reference_id').unsigned().comment('Cart ID, order ID, etc.');
      table.string('reference_type', 50);
      table.timestamp('reserved_at').defaultTo(knex.fn.now());
      table.timestamp('expires_at').nullable().comment('Auto-release reservation after expiry');
      table.enum('status', ['ACTIVE', 'FULFILLED', 'RELEASED', 'EXPIRED']).defaultTo('ACTIVE');
      table.timestamp('released_at').nullable();

      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      
      table.index(['product_id', 'status']);
      table.index(['user_id', 'status']);
      table.index('expires_at');
    });
  }

  // Create low_stock_alerts table
  const hasLowStockAlerts = await knex.schema.hasTable('low_stock_alerts');
  if (!hasLowStockAlerts) {
    await knex.schema.createTable('low_stock_alerts', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('current_quantity').notNullable();
      table.integer('threshold').notNullable();
      table.enum('status', ['PENDING', 'ACKNOWLEDGED', 'RESOLVED']).defaultTo('PENDING');
      table.integer('acknowledged_by').unsigned();
      table.timestamp('acknowledged_at').nullable();
      table.timestamp('resolved_at').nullable();
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      table.foreign('acknowledged_by').references('users.id').onDelete('SET NULL');
      
      table.index(['product_id', 'status']);
      table.index('status');
    });
  }

  // Create inventory_suppliers table
  const hasInventorySuppliers = await knex.schema.hasTable('inventory_suppliers');
  if (!hasInventorySuppliers) {
    await knex.schema.createTable('inventory_suppliers', (table) => {
      table.increments('id').primary();
      table.string('name', 255).notNullable();
      table.string('contact_person', 255);
      table.string('email', 255);
      table.string('phone', 50);
      table.text('address');
      table.string('website', 255);
      table.text('notes');
      table.enum('status', ['ACTIVE', 'INACTIVE']).defaultTo('ACTIVE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }

  // Create product_suppliers junction table
  const hasProductSuppliers = await knex.schema.hasTable('product_suppliers');
  if (!hasProductSuppliers) {
    await knex.schema.createTable('product_suppliers', (table) => {
      table.increments('id').primary();
      table.integer('product_id').unsigned().notNullable();
      table.integer('supplier_id').unsigned().notNullable();
      table.decimal('supplier_price', 10, 2);
      table.integer('lead_time_days').comment('Days to receive stock from supplier');
      table.integer('minimum_order_quantity').defaultTo(1);
      table.boolean('is_primary').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('product_id').references('products.id').onDelete('CASCADE');
      table.foreign('supplier_id').references('inventory_suppliers.id').onDelete('CASCADE');
      
      table.unique(['product_id', 'supplier_id']);
      table.index('supplier_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('product_suppliers');
  await knex.schema.dropTableIfExists('inventory_suppliers');
  await knex.schema.dropTableIfExists('low_stock_alerts');
  await knex.schema.dropTableIfExists('stock_reservations');
  await knex.schema.dropTableIfExists('inventory_history');
  
  const hasQuantity = await knex.schema.hasColumn('products', 'quantity');
  if (hasQuantity) {
    await knex.schema.table('products', (table) => {
      table.dropColumn('quantity');
      table.dropColumn('reserved_quantity');
      table.dropColumn('low_stock_threshold');
      table.dropColumn('stock_status');
      table.dropColumn('track_inventory');
      table.dropColumn('sku');
      table.dropColumn('barcode');
      table.dropColumn('reorder_point');
      table.dropColumn('reorder_quantity');
    });
  }
};
