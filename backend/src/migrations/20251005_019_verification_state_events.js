/**
 * verification_state_events: logs every status transition for audit
 * Columns: id, user_id, from_status, to_status, actor_id (nullable), metadata (JSON text), created_at
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('verification_state_events');
  if (!exists) {
    await knex.schema.createTable('verification_state_events', t => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('from_status').notNullable();
      t.string('to_status').notNullable();
      t.integer('actor_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.text('metadata');
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.index(['user_id','created_at']);
      t.index(['to_status']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('verification_state_events');
};
