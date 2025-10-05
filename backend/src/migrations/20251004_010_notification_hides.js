/**
 * Add per-user notification hide capability.
 * Table: notification_hides
 * Columns: id, notification_id (fk notifications.id), user_id (fk users.id), hidden_at
 */

exports.up = async function(knex) {
  const has = await knex.schema.hasTable('notification_hides');
  if (!has) {
    await knex.schema.createTable('notification_hides', (t) => {
      t.increments('id').primary();
      t.integer('notification_id').unsigned().notNullable().index();
      t.integer('user_id').unsigned().notNullable().index();
      t.timestamp('hidden_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('notification_id').references('id').inTable('notifications').onDelete('CASCADE');
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.unique(['notification_id','user_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notification_hides');
};
