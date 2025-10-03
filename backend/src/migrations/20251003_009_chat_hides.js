/**
 * Hides allow per-user soft deletion of messages/threads
 * - chat_message_hides: id, message_id, user_id, hidden_at
 *   unique (message_id, user_id)
 * - chat_thread_hides: id, thread_id, user_id, hidden_at
 *   unique (thread_id, user_id)
 */

exports.up = async function(knex) {
  const hasMsgHides = await knex.schema.hasTable('chat_message_hides');
  if (!hasMsgHides) {
    await knex.schema.createTable('chat_message_hides', (t)=>{
      t.increments('id').primary();
      t.integer('message_id').unsigned().notNullable().index();
      t.integer('user_id').unsigned().notNullable().index();
      t.timestamp('hidden_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('message_id').references('id').inTable('chat_messages').onDelete('CASCADE');
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.unique(['message_id','user_id']);
    });
  }

  const hasThreadHides = await knex.schema.hasTable('chat_thread_hides');
  if (!hasThreadHides) {
    await knex.schema.createTable('chat_thread_hides', (t)=>{
      t.increments('id').primary();
      t.integer('thread_id').unsigned().notNullable().index();
      t.integer('user_id').unsigned().notNullable().index();
      t.timestamp('hidden_at').notNullable().defaultTo(knex.fn.now());
      t.foreign('thread_id').references('id').inTable('chat_threads').onDelete('CASCADE');
      t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      t.unique(['thread_id','user_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('chat_thread_hides');
  await knex.schema.dropTableIfExists('chat_message_hides');
};
