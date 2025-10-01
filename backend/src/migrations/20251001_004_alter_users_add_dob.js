exports.up = async function(knex) {
  const hasDob = await knex.schema.hasColumn('users', 'dob');
  if (!hasDob) {
    await knex.schema.alterTable('users', (t) => {
      t.date('dob').nullable().after('address');
    });
  }
};

exports.down = async function(knex) {
  const hasDob = await knex.schema.hasColumn('users', 'dob');
  if (hasDob) {
    await knex.schema.alterTable('users', (t) => {
      t.dropColumn('dob');
    });
  }
};
