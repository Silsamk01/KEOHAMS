/**
 * Performance indexes for high-read tables.
 */

exports.up = async function(knex) {
  // Users: frequent lookups by email & name for auth / search
  const hasUsers = await knex.schema.hasTable('users');
  if (hasUsers) {
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'); } catch(_) {}
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_name ON users(name)'); } catch(_) {}
  }
  // Products: category + created_at for listing & sorting
  const hasProducts = await knex.schema.hasTable('products');
  if (hasProducts) {
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)'); } catch(_) {}
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at)'); } catch(_) {}
  }
  // Notifications: user_id unread filtering
  const hasNotifications = await knex.schema.hasTable('notifications');
  if (hasNotifications) {
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at)'); } catch(_) {}
  }
  // Chats threads/messages (assuming tables chats (threads) & chat_messages)
  const hasChats = await knex.schema.hasTable('chats');
  if (hasChats) {
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_chats_owner ON chats(owner_id)'); } catch(_) {}
  }
  const hasChatMessages = await knex.schema.hasTable('chat_messages');
  if (hasChatMessages) {
    try { await knex.raw('CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_created ON chat_messages(thread_id, created_at)'); } catch(_) {}
  }
};

exports.down = async function(knex) {
  // Best-effort drops (MySQL uses DROP INDEX index_name ON table)
  const drop = async (table, index) => { try { await knex.raw(`DROP INDEX ${index} ON ${table}`); } catch(_) {} };
  await drop('users', 'idx_users_email');
  await drop('users', 'idx_users_name');
  await drop('products', 'idx_products_category');
  await drop('products', 'idx_products_created_at');
  await drop('notifications', 'idx_notifications_user_unread');
  await drop('chats', 'idx_chats_owner');
  await drop('chat_messages', 'idx_chat_messages_thread_created');
};
