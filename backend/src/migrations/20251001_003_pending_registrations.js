exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('pending_registrations');
  if (!exists) {
    await knex.schema.createTable('pending_registrations', (t) => {
      t.increments('id').primary();
      t.string('name').notNullable();
      t.string('email').notNullable();
      t.string('password_hash').notNullable();
      t.string('phone');
      t.string('address');
      t.date('dob').notNullable();
      t.string('token').notNullable().unique();
      t.dateTime('expires_at').notNullable();
      t.timestamps(true, true);
    });
    await knex.schema.alterTable('pending_registrations', (t) => {
      t.index('email');
      t.index('token');
      t.index('expires_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('pending_registrations');
};
