exports.up = async function(knex){
  const exists = await knex.schema.hasTable('contact_messages');
  if (exists) return;
  await knex.schema.createTable('contact_messages', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('name', 120).notNullable();
    table.string('email', 180).notNullable();
    table.string('subject', 180).notNullable();
    table.text('body').notNullable();
    table.boolean('is_read').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function(knex){
  const exists = await knex.schema.hasTable('contact_messages');
  if (exists) await knex.schema.dropTable('contact_messages');
};
