/**
 * Clean up incorrect index attempts referencing notifications.read_at (column does not exist).
 * Adds pragmatic indexes on (audience,user_id,created_at) for common listing filters.
 */
exports.up = async function(knex) {
  const has = await knex.schema.hasTable('notifications');
  if (!has) return;
  // Drop any orphaned index if it was created under a different engine (best effort)
  try { await knex.raw('DROP INDEX idx_notifications_user_unread ON notifications'); } catch(_) {}
  try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_notifications_audience_user_created ON notifications(audience, user_id, created_at)'); } catch(_) {}
};

exports.down = async function(knex) {
  const has = await knex.schema.hasTable('notifications');
  if (!has) return;
  try { await knex.raw('DROP INDEX idx_notifications_audience_user_created ON notifications'); } catch(_) {}
};
