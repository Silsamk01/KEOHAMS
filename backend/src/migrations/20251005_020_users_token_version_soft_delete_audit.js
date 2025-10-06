/**
 * Adds token_version + deleted_at to users and introduces admin_audit_events table
 */
exports.up = async function(knex){
  const hasTokenVersion = await knex.schema.hasColumn('users','token_version');
  if(!hasTokenVersion){
    await knex.schema.alterTable('users', t => {
      t.integer('token_version').notNullable().defaultTo(1).after('password_hash');
      t.dateTime('deleted_at').nullable().after('updated_at');
    });
  }
  const hasAudit = await knex.schema.hasTable('admin_audit_events');
  if(!hasAudit){
    await knex.schema.createTable('admin_audit_events', t => {
      t.increments('id').primary();
      // Must be nullable if ON DELETE SET NULL is used
      t.integer('admin_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.integer('target_user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.string('action').notNullable(); // USER_DELETE, TOKEN_REVOKE, PASSWORD_RESET, etc.
      t.json('metadata').nullable();
      t.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
      t.index(['target_user_id','action']);
      t.index(['created_at']);
    });
    // MySQL sometimes requires explicit engine for FK; ensure InnoDB
    try { await knex.raw('ALTER TABLE admin_audit_events ENGINE=InnoDB'); } catch(_){}
  }
};

exports.down = async function(knex){
  const hasAudit = await knex.schema.hasTable('admin_audit_events');
  if(hasAudit){
    await knex.schema.dropTable('admin_audit_events');
  }
  const hasTokenVersion = await knex.schema.hasColumn('users','token_version');
  if(hasTokenVersion){
    await knex.schema.alterTable('users', t => {
      t.dropColumn('token_version');
      t.dropColumn('deleted_at');
    });
  }
};
