/**
 * Feature 10: Wishlist & Favorites System
 * - User wishlists with items
 * - Share wishlist functionality
 * - Price drop alerts
 */
exports.up = async function (knex) {
  // Create wishlists table
  if (!(await knex.schema.hasTable('wishlists'))) {
    await knex.schema.createTable('wishlists', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('name', 100).notNullable().defaultTo('My Wishlist');
      table.text('description').nullable();
      table.boolean('is_public').defaultTo(false);
      table.string('share_token', 64).unique().nullable();
      table.timestamps(true, true);
      
      table.index('user_id');
      table.index('share_token');
    });
  }

  // Create wishlist_items table
  if (!(await knex.schema.hasTable('wishlist_items'))) {
    await knex.schema.createTable('wishlist_items', (table) => {
      table.increments('id').primary();
      table.integer('wishlist_id').unsigned().notNullable()
        .references('id').inTable('wishlists').onDelete('CASCADE');
      table.integer('product_id').unsigned().notNullable()
        .references('id').inTable('products').onDelete('CASCADE');
      table.integer('quantity').unsigned().defaultTo(1);
      table.decimal('price_when_added', 10, 2).notNullable();
      table.text('notes').nullable();
      table.boolean('notify_price_drop').defaultTo(false);
      table.decimal('target_price', 10, 2).nullable(); // Alert when price drops below this
      table.timestamps(true, true);
      
      table.index('wishlist_id');
      table.index('product_id');
      table.unique(['wishlist_id', 'product_id']); // Prevent duplicate items
    });
  }

  // Create wishlist_shares table (track who viewed shared wishlists)
  if (!(await knex.schema.hasTable('wishlist_shares'))) {
    await knex.schema.createTable('wishlist_shares', (table) => {
      table.increments('id').primary();
      table.integer('wishlist_id').unsigned().notNullable()
        .references('id').inTable('wishlists').onDelete('CASCADE');
      table.string('visitor_ip', 45).nullable();
      table.text('visitor_user_agent').nullable();
      table.integer('viewed_by_user_id').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('viewed_at').defaultTo(knex.fn.now());
      
      table.index('wishlist_id');
      table.index('viewed_by_user_id');
    });
  }

  // Create price_drop_alerts table (track sent alerts)
  if (!(await knex.schema.hasTable('price_drop_alerts'))) {
    await knex.schema.createTable('price_drop_alerts', (table) => {
      table.increments('id').primary();
      table.integer('wishlist_item_id').unsigned().notNullable()
        .references('id').inTable('wishlist_items').onDelete('CASCADE');
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.decimal('old_price', 10, 2).notNullable();
      table.decimal('new_price', 10, 2).notNullable();
      table.boolean('notification_sent').defaultTo(false);
      table.timestamp('sent_at').nullable();
      table.timestamps(true, true);
      
      table.index('wishlist_item_id');
      table.index('user_id');
      table.index(['notification_sent', 'created_at']);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('price_drop_alerts');
  await knex.schema.dropTableIfExists('wishlist_shares');
  await knex.schema.dropTableIfExists('wishlist_items');
  await knex.schema.dropTableIfExists('wishlists');
};
