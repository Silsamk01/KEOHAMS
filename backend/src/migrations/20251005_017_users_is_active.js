/**
 * Add is_active flag to users for post-verification administrative activation control.
 */
exports.up = async function(knex) {
  const has = await knex.schema.hasColumn('users','is_active');
  if (!has) {
    await knex.schema.alterTable('users', (t)=>{
      t.boolean('is_active').notNullable().defaultTo(true).after('email_verified');
    });
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)'); } catch(_) {}
  }
};

exports.down = async function(knex) {
  const has = await knex.schema.hasColumn('users','is_active');
  if (has) {
    await knex.schema.alterTable('users', (t)=> t.dropColumn('is_active'));
  }
};
