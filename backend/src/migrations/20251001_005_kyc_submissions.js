/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('kyc_submissions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('status').notNullable().defaultTo('PENDING'); // PENDING, APPROVED, REJECTED
    table.json('files').nullable(); // JSON object of file paths
    table.text('notes').nullable();
    table.timestamp('submitted_at').defaultTo(knex.fn.now());
    table.integer('reviewer_id').unsigned().nullable().references('id').inTable('users');
    table.timestamp('reviewed_at').nullable();
    table.text('review_notes').nullable();
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('kyc_submissions');
};
