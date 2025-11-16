/**
 * Migration: Security Enhancements
 * Adds security audit logging, login attempts tracking, and GDPR compliance
 */

exports.up = async function(knex) {
  // Create security_audit_log table
  const hasSecurityAuditLog = await knex.schema.hasTable('security_audit_log');
  if (!hasSecurityAuditLog) {
    await knex.schema.createTable('security_audit_log', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned();
      table.enum('event_type', [
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'PASSWORD_CHANGE',
        'PASSWORD_RESET',
        'EMAIL_CHANGE',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
        'PERMISSION_CHANGE',
        'DATA_EXPORT',
        'DATA_DELETE',
        'SUSPICIOUS_ACTIVITY',
        'API_KEY_GENERATED',
        '2FA_ENABLED',
        '2FA_DISABLED'
      ]).notNullable();
      table.string('ip_address', 45);
      table.string('user_agent', 500);
      table.json('metadata').comment('Additional event details');
      table.enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).defaultTo('LOW');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      
      table.index(['user_id', 'created_at']);
      table.index('event_type');
      table.index('severity');
      table.index('created_at');
    });
  }

  // Create login_attempts table
  const hasLoginAttempts = await knex.schema.hasTable('login_attempts');
  if (!hasLoginAttempts) {
    await knex.schema.createTable('login_attempts', (table) => {
      table.increments('id').primary();
      table.string('email', 255).notNullable();
      table.string('ip_address', 45).notNullable();
      table.boolean('success').defaultTo(false);
      table.text('failure_reason');
      table.timestamp('attempted_at').defaultTo(knex.fn.now());

      table.index(['email', 'attempted_at']);
      table.index(['ip_address', 'attempted_at']);
    });
  }

  // Create account_locks table
  const hasAccountLocks = await knex.schema.hasTable('account_locks');
  if (!hasAccountLocks) {
    await knex.schema.createTable('account_locks', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.enum('lock_type', ['FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY', 'ADMIN_LOCK', 'SECURITY_BREACH']).notNullable();
      table.text('reason');
      table.timestamp('locked_at').defaultTo(knex.fn.now());
      table.timestamp('unlock_at').nullable().comment('Auto-unlock time');
      table.boolean('is_permanent').defaultTo(false);
      table.integer('locked_by').unsigned().comment('Admin who locked the account');
      table.timestamp('unlocked_at').nullable();
      table.integer('unlocked_by').unsigned();

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('locked_by').references('users.id').onDelete('SET NULL');
      table.foreign('unlocked_by').references('users.id').onDelete('SET NULL');
      
      table.index(['user_id', 'unlocked_at']);
    });
  }

  // Create gdpr_data_requests table
  const hasGdprRequests = await knex.schema.hasTable('gdpr_data_requests');
  if (!hasGdprRequests) {
    await knex.schema.createTable('gdpr_data_requests', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().notNullable();
      table.enum('request_type', ['DATA_EXPORT', 'DATA_DELETE', 'DATA_PORTABILITY']).notNullable();
      table.enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).defaultTo('PENDING');
      table.text('notes');
      table.string('export_file_url', 500).comment('URL to download exported data');
      table.timestamp('requested_at').defaultTo(knex.fn.now());
      table.timestamp('completed_at').nullable();
      table.integer('processed_by').unsigned();

      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.foreign('processed_by').references('users.id').onDelete('SET NULL');
      
      table.index(['user_id', 'status']);
      table.index('status');
    });
  }

  // Add security fields to users table if they don't exist
  const hasLockFields = await knex.schema.hasColumn('users', 'is_locked');
  if (!hasLockFields) {
    await knex.schema.table('users', (table) => {
      table.boolean('is_locked').defaultTo(false);
      table.timestamp('locked_until').nullable();
      table.integer('failed_login_attempts').defaultTo(0);
      table.timestamp('last_failed_login').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasLockFields = await knex.schema.hasColumn('users', 'is_locked');
  if (hasLockFields) {
    await knex.schema.table('users', (table) => {
      table.dropColumn('is_locked');
      table.dropColumn('locked_until');
      table.dropColumn('failed_login_attempts');
      table.dropColumn('last_failed_login');
    });
  }

  await knex.schema.dropTableIfExists('gdpr_data_requests');
  await knex.schema.dropTableIfExists('account_locks');
  await knex.schema.dropTableIfExists('login_attempts');
  await knex.schema.dropTableIfExists('security_audit_log');
};
