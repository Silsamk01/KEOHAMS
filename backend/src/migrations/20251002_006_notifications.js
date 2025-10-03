/**
 * Notifications schema
 * tables:
 * - notifications: id, title, body, audience (ALL|USER), user_id (nullable), url (nullable), created_at
 * - notification_reads: id, notification_id, user_id, read_at
 */

exports.up = async function(knex) {
  const hasNotifications = await knex.schema.hasTable('notifications');
  if (!hasNotifications) {
    await knex.schema.createTable('notifications', (t) => {
      t.increments('id').primary();
      t.string('title').notNullable();
      t.text('body').notNullable();
      t.enu('audience', ['ALL','USER']).notNullable().defaultTo('ALL');
      t.integer('user_id').unsigned().nullable().index();
      t.string('url').nullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
    await knex.schema.alterTable('notifications', (t)=>{
      t.index(['audience','user_id']);
      t.index(['created_at']);
    });
  }

  const hasReads = await knex.schema.hasTable('notification_reads');
  if (!hasReads) {
    await knex.schema.createTable('notification_reads', (t) => {
      t.increments('id').primary();
      t.integer('notification_id').unsigned().notNullable().index();
      t.integer('user_id').unsigned().notNullable().index();
      t.timestamp('read_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('notification_id').references('id').inTable('notifications').onDelete('CASCADE');
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.unique(['notification_id','user_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('notification_reads');
  await knex.schema.dropTableIfExists('notifications');
};
