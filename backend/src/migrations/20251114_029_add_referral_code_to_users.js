/**
 * Add referral_code column to users and pending_registrations tables
 * This links shop users to the affiliate who referred them
 */

exports.up = async function(knex) {
  // Add referral_code to pending_registrations if table exists
  const hasPendingRegs = await knex.schema.hasTable('pending_registrations');
  if (hasPendingRegs) {
    const hasColumn = await knex.schema.hasColumn('pending_registrations', 'referral_code');
    if (!hasColumn) {
      await knex.schema.table('pending_registrations', (t) => {
        t.string('referral_code', 20).nullable().comment('Referral code used during registration');
      });
    }
  }
  
  // Add referral_code to users table
  const hasUsersColumn = await knex.schema.hasColumn('users', 'referral_code');
  if (!hasUsersColumn) {
    await knex.schema.table('users', (t) => {
      t.string('referral_code', 20).nullable().comment('Affiliate referral code that referred this user');
      t.index('referral_code');
    });
  }
};

exports.down = async function(knex) {
  // Remove referral_code from pending_registrations
  const hasPendingRegs = await knex.schema.hasTable('pending_registrations');
  if (hasPendingRegs) {
    const hasColumn = await knex.schema.hasColumn('pending_registrations', 'referral_code');
    if (hasColumn) {
      await knex.schema.table('pending_registrations', (t) => {
        t.dropColumn('referral_code');
      });
    }
  }
  
  // Remove referral_code from users
  const hasUsersColumn = await knex.schema.hasColumn('users', 'referral_code');
  if (hasUsersColumn) {
    await knex.schema.table('users', (t) => {
      t.dropIndex('referral_code');
      t.dropColumn('referral_code');
    });
  }
};
