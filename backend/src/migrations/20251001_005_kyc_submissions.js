exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('kyc_submissions');
  if (!exists) {
    await knex.schema.createTable('kyc_submissions', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.enum('status', ['PENDING', 'APPROVED', 'REJECTED']).notNullable().defaultTo('PENDING');
      t.string('type').notNullable().defaultTo('ID');
      t.json('files'); // array of file paths or metadata
      t.text('notes'); // user-provided notes
      t.integer('reviewer_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
      t.text('review_notes');
  t.timestamp('submitted_at').defaultTo(knex.fn.now());
  // reviewed_at should be NULL until a reviewer takes action; make the default explicit for MySQL strict mode
  t.timestamp('reviewed_at').nullable().defaultTo(null);
      t.timestamps(true, true);
    });
    await knex.schema.alterTable('kyc_submissions', (t) => {
      t.index(['status']);
      t.index(['user_id']);
      t.index(['submitted_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('kyc_submissions');
};