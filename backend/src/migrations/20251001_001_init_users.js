/**
 * Initial users table for auth and basic profile
 */
exports.up = async function(knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('email').notNullable().unique();
    t.string('password_hash').notNullable();
    t.string('phone');
    t.string('address');
    t.enum('role', ['ADMIN', 'CUSTOMER']).notNullable().defaultTo('CUSTOMER');
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.string('twofa_secret');
    t.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('users');
};
