/**
 * Create blog posts table
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('posts');
  if (exists) return;
  await knex.schema.createTable('posts', (t) => {
    t.increments('id').primary();
    t.string('title').notNullable();
    t.string('slug').notNullable().unique();
    t.text('excerpt');
    t.text('content').notNullable();
    t.boolean('require_login').notNullable().defaultTo(false);
    t.enum('status', ['DRAFT', 'PUBLISHED']).notNullable().defaultTo('DRAFT');
    t.integer('author_id').unsigned();
    t.timestamp('published_at');
    t.timestamps(true, true); // created_at, updated_at
    t.index(['status', 'published_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('posts');
};
