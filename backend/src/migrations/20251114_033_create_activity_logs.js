/**
 * Migration: Create activity_logs table for tracking all user activities
 * @param {import('knex').Knex} knex
 */
exports.up = async function(knex) {
  await knex.schema.createTable('activity_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable();
    table.enum('user_type', ['ADMIN', 'USER', 'AFFILIATE']).notNullable();
    table.string('action', 100).notNullable(); // LOGIN, LOGOUT, CREATE_PRODUCT, UPDATE_USER, etc.
    table.string('entity_type', 50).nullable(); // product, user, order, quotation, etc.
    table.integer('entity_id').unsigned().nullable();
    table.text('description').nullable();
    table.json('metadata').nullable(); // Additional context
    table.string('ip_address', 45).nullable();
    table.string('user_agent').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    table.index('user_id');
    table.index('user_type');
    table.index('action');
    table.index('entity_type');
    table.index('created_at');
    
    // Foreign key (nullable to handle system actions or deleted users)
    table.foreign('user_id').references('users.id').onDelete('SET NULL');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('activity_logs');
};
