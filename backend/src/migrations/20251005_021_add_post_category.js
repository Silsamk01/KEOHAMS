/** Adds category column & index to posts */
exports.up = async function(knex){
  const has = await knex.schema.hasColumn('posts','category');
  if(!has){
    await knex.schema.alterTable('posts', t => {
      t.string('category', 80).nullable().after('slug');
      t.index(['category']);
      t.index(['published_at']);
    });
  }
};

exports.down = async function(knex){
  const has = await knex.schema.hasColumn('posts','category');
  if(has){
    await knex.schema.alterTable('posts', t => {
      t.dropIndex(['category']);
      t.dropColumn('category');
    });
  }
};
