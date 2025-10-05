exports.up = async function(knex){
  const exists = await knex.schema.hasTable('notification_read_events');
  if (exists) return;
  await knex.schema.createTable('notification_read_events', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('notification_id').unsigned().notNullable().references('id').inTable('notifications').onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['user_id']);
    table.index(['notification_id']);
    table.index(['created_at']);
  });
};

exports.down = async function(knex){
  const exists = await knex.schema.hasTable('notification_read_events');
  if (exists) await knex.schema.dropTable('notification_read_events');
};