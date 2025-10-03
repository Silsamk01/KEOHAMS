exports.up = async function(knex) {
  const hasOrders = await knex.schema.hasTable('orders');
  if (!hasOrders) {
    await knex.schema.createTable('orders', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('status').notNullable().defaultTo('PENDING'); // PENDING/PAID/SHIPPED/CANCELLED
      t.decimal('total_amount', 12, 2).notNullable().defaultTo(0);
      t.timestamps(true, true);
    });
  }

  const hasItems = await knex.schema.hasTable('order_items');
  if (!hasItems) {
    await knex.schema.createTable('order_items', (t) => {
      t.increments('id').primary();
      t.integer('order_id').unsigned().notNullable().references('id').inTable('orders').onDelete('CASCADE');
      t.integer('product_id').unsigned().notNullable().references('id').inTable('products');
      t.integer('quantity').unsigned().notNullable().defaultTo(1);
      t.decimal('unit_price', 12, 2).notNullable().defaultTo(0);
      t.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('order_items');
  await knex.schema.dropTableIfExists('orders');
};