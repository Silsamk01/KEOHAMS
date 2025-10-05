exports.up = async function(knex) {
  // Add avatar_url column if missing
  const hasAvatar = await knex.schema.hasColumn('users', 'avatar_url');
  if (!hasAvatar) {
    await knex.schema.alterTable('users', (t) => {
      t.string('avatar_url').nullable().after('twofa_secret');
    });
  }

  // Create twofa_recovery_codes table if not exists
  const hasRecovery = await knex.schema.hasTable('twofa_recovery_codes');
  if (!hasRecovery) {
    await knex.schema.createTable('twofa_recovery_codes', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('code_hash').notNullable();
      t.boolean('used').notNullable().defaultTo(false);
      t.timestamp('used_at').nullable().defaultTo(null);
      t.timestamps(true, true);
    });
    await knex.schema.alterTable('twofa_recovery_codes', (t) => {
      t.index(['user_id', 'used']);
    });
  }
};

exports.down = async function(knex) {
  const hasAvatar = await knex.schema.hasColumn('users', 'avatar_url');
  if (hasAvatar) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('avatar_url'));
  }
  await knex.schema.dropTableIfExists('twofa_recovery_codes');
};
