/** Modernize blog posts: add cover, reading time, view count, seo fields, and tags tables */
exports.up = async function(knex){
  // Extend posts table
  const hasCover = await knex.schema.hasColumn('posts','cover_image');
  await knex.schema.alterTable('posts', t => {
    if(!hasCover) t.string('cover_image');
    if(!t._single?.fields?.includes?.('reading_minutes')) t.integer('reading_minutes').unsigned();
    if(!t._single?.fields?.includes?.('view_count')) t.integer('view_count').unsigned().notNullable().defaultTo(0).index();
    if(!t._single?.fields?.includes?.('seo_title')) t.string('seo_title');
    if(!t._single?.fields?.includes?.('seo_description')) t.string('seo_description', 300);
  });
  // Tags table
  const hasTags = await knex.schema.hasTable('tags');
  if(!hasTags){
    await knex.schema.createTable('tags', t => {
      t.increments('id').primary();
      t.string('name', 60).notNullable().unique();
      t.timestamps(true,true);
    });
  }
  const hasPostTags = await knex.schema.hasTable('post_tags');
  if(!hasPostTags){
    await knex.schema.createTable('post_tags', t => {
      t.increments('id').primary();
      t.integer('post_id').unsigned().notNullable().references('id').inTable('posts').onDelete('CASCADE');
      t.integer('tag_id').unsigned().notNullable().references('id').inTable('tags').onDelete('CASCADE');
      t.unique(['post_id','tag_id']);
      t.index(['tag_id']);
    });
  }
};

exports.down = async function(knex){
  const hasPostTags = await knex.schema.hasTable('post_tags');
  if(hasPostTags) await knex.schema.dropTable('post_tags');
  const hasTags = await knex.schema.hasTable('tags');
  if(hasTags) await knex.schema.dropTable('tags');
  // Columns removal (idempotent)
  const cols = ['cover_image','reading_minutes','view_count','seo_title','seo_description'];
  for (const col of cols){
    const hasCol = await knex.schema.hasColumn('posts', col);
    if (hasCol){
      await knex.schema.alterTable('posts', t => { t.dropColumn(col); });
    }
  }
};
