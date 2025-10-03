/**
 * Chat schema
 * tables:
 * - chat_threads: id, user_id, product_id (nullable), subject (nullable), created_by, created_at
 *   unique index on (user_id, product_id) to ensure one thread per product per user (product_id can be null)
 * - chat_messages: id, thread_id, sender_id, body, created_at, seen_at (nullable)
 */

exports.up = async function(knex) {
  const hasThreads = await knex.schema.hasTable('chat_threads');
  if (!hasThreads) {
    await knex.schema.createTable('chat_threads', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().index();
      t.integer('product_id').unsigned().nullable().index();
      t.string('subject').nullable();
      t.integer('created_by').unsigned().notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.foreign('product_id').references('id').inTable('products').onDelete('SET NULL');
      t.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    });
    await knex.schema.alterTable('chat_threads', (t) => {
      t.unique(['user_id', 'product_id']);
      t.index(['created_at']);
    });
  }

  const hasMessages = await knex.schema.hasTable('chat_messages');
  if (!hasMessages) {
    await knex.schema.createTable('chat_messages', (t) => {
      t.increments('id').primary();
      t.integer('thread_id').unsigned().notNullable().index();
      t.integer('sender_id').unsigned().notNullable().index();
      t.text('body').notNullable();
      t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
      t.timestamp('seen_at').nullable();
      t.foreign('thread_id').references('id').inTable('chat_threads').onDelete('CASCADE');
      t.foreign('sender_id').references('id').inTable('users').onDelete('CASCADE');
    });
    await knex.schema.alterTable('chat_messages', (t) => {
      t.index(['thread_id', 'created_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_threads');
};
