exports.up = async function(knex) {
  await knex.schema.createTable('categories', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.integer('parent_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('products', (t) => {
    t.increments('id').primary();
    t.string('title').notNullable();
    t.text('description');
    t.integer('moq').notNullable().defaultTo(1);
    t.decimal('price_per_unit', 12, 2).notNullable();
    t.enum('stock_status', ['IN_STOCK', 'OUT_OF_STOCK', 'PREORDER']).notNullable().defaultTo('IN_STOCK');
    t.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
    t.json('images');
    t.json('videos');
    t.boolean('active').notNullable().defaultTo(true);
    t.timestamps(true, true);
  });

  await knex.schema.createTable('bulk_discounts', (t) => {
    t.increments('id').primary();
    t.integer('product_id').unsigned().notNullable().references('id').inTable('products').onDelete('CASCADE');
    t.integer('min_qty').notNullable();
    t.integer('max_qty');
    t.decimal('unit_price', 12, 2).notNullable();
    t.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('bulk_discounts');
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
};
