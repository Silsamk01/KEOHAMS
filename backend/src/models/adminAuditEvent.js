const db = require('../config/db');
const TABLE = 'admin_audit_events';

function log({ admin_id, target_user_id, action, metadata }) {
  return db(TABLE).insert({ admin_id, target_user_id, action, metadata: metadata ? JSON.stringify(metadata) : null });
}

module.exports = { TABLE, log };
