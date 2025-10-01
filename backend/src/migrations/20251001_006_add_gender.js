exports.up = async function(knex) {
  const hasUsersGender = await knex.schema.hasColumn('users', 'gender');
  if (!hasUsersGender) {
    await knex.schema.alterTable('users', (t) => {
      t.enum('gender', ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).nullable().after('dob');
    });
  }

  const hasPendingGender = await knex.schema.hasColumn('pending_registrations', 'gender');
  if (!hasPendingGender) {
    await knex.schema.alterTable('pending_registrations', (t) => {
      t.enum('gender', ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY']).nullable().after('dob');
      t.index(['gender']);
    });
  }
};

exports.down = async function(knex) {
  const hasUsersGender = await knex.schema.hasColumn('users', 'gender');
  if (hasUsersGender) {
    await knex.schema.alterTable('users', (t) => t.dropColumn('gender'));
  }
  const hasPendingGender = await knex.schema.hasColumn('pending_registrations', 'gender');
  if (hasPendingGender) {
    await knex.schema.alterTable('pending_registrations', (t) => t.dropColumn('gender'));
  }
};
