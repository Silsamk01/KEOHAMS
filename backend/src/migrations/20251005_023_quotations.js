/** Quotation & quotation_items tables */
exports.up = async function(knex){
  const hasQ = await knex.schema.hasTable('quotations');
  if(!hasQ){
    await knex.schema.createTable('quotations', t => {
      t.increments('id').primary();
      t.string('reference').notNullable().unique();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
  t.enum('status', ['REQUESTED','REPLIED','PAID','CANCELLED']).notNullable().defaultTo('REQUESTED');
      t.decimal('subtotal_amount', 12,2).notNullable().defaultTo(0);
      t.decimal('logistics_amount', 12,2).notNullable().defaultTo(0);
      t.decimal('discount_amount', 12,2).notNullable().defaultTo(0);
      t.decimal('total_amount', 12,2).notNullable().defaultTo(0);
      t.string('currency', 8).notNullable().defaultTo('USD');
      t.string('allowed_payment_methods', 120); // CSV: stripe,paystack,crypto
      t.text('notes_user');
      t.text('notes_admin');
  // Use DATETIME (or nullable timestamp) for optional fields to avoid MySQL multiple timestamp default constraints
  t.dateTime('replied_at').nullable();
  t.dateTime('paid_at').nullable();
      t.timestamps(true,true);
      t.index(['user_id','status']);
    });
  }
  const hasQI = await knex.schema.hasTable('quotation_items');
  if(!hasQI){
    await knex.schema.createTable('quotation_items', t => {
      t.increments('id').primary();
      t.integer('quotation_id').unsigned().notNullable().references('id').inTable('quotations').onDelete('CASCADE');
      t.integer('product_id').unsigned().notNullable().references('id').inTable('products');
      t.string('product_name').notNullable();
      t.integer('quantity').unsigned().notNullable().defaultTo(1);
      t.decimal('unit_price', 12,2).notNullable().defaultTo(0);
      t.decimal('line_total', 12,2).notNullable().defaultTo(0);
      t.timestamps(true,true);
      t.index(['quotation_id']);
    });
  }
};

exports.down = async function(knex){
  await knex.schema.dropTableIfExists('quotation_items');
  await knex.schema.dropTableIfExists('quotations');
};
