/**
 * Add missing foreign key indexes for performance
 * Indexes speed up JOINs and WHERE clauses on foreign keys
 */
exports.up = async function(knex) {
  // Helper to check if index exists
  async function addIndexIfNotExists(table, columns, indexName) {
    const hasIndex = await knex.schema.hasTable(table).then(exists => {
      if (!exists) return false;
      return knex.raw(`
        SELECT COUNT(*) as count 
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = ? 
        AND index_name = ?
      `, [table, indexName]).then(([rows]) => rows[0].count > 0);
    });

    if (!hasIndex) {
      await knex.schema.alterTable(table, (t) => {
        t.index(columns, indexName);
      });
      console.log(`✓ Created index ${indexName} on ${table}(${columns.join(', ')})`);
    } else {
      console.log(`  Index ${indexName} already exists on ${table}`);
    }
  }

  // Quotations table indexes
  await addIndexIfNotExists('quotations', ['user_id'], 'idx_quotations_user_id');
  await addIndexIfNotExists('quotations', ['status'], 'idx_quotations_status');
  await addIndexIfNotExists('quotations', ['created_at'], 'idx_quotations_created_at');
  await addIndexIfNotExists('quotations', ['status', 'user_id'], 'idx_quotations_status_user');

  // KYC submissions indexes
  await addIndexIfNotExists('kyc_submissions', ['reviewer_id'], 'idx_kyc_submissions_reviewer_id');
  await addIndexIfNotExists('kyc_submissions', ['status', 'created_at'], 'idx_kyc_submissions_status_created');
  
  // Orders table if it exists
  const hasOrders = await knex.schema.hasTable('orders');
  if (hasOrders) {
    await addIndexIfNotExists('orders', ['user_id'], 'idx_orders_user_id');
    await addIndexIfNotExists('orders', ['status'], 'idx_orders_status');
    await addIndexIfNotExists('orders', ['created_at'], 'idx_orders_created_at');
  }

  // Chat messages indexes for performance
  const hasChatMessages = await knex.schema.hasTable('chat_messages');
  if (hasChatMessages) {
    await addIndexIfNotExists('chat_messages', ['thread_id', 'created_at'], 'idx_chat_messages_thread_created');
    await addIndexIfNotExists('chat_messages', ['sender_id'], 'idx_chat_messages_sender_id');
  }

  // Notification indexes
  const hasNotifications = await knex.schema.hasTable('notifications');
  if (hasNotifications) {
    await addIndexIfNotExists('notifications', ['user_id', 'created_at'], 'idx_notifications_user_created');
  }

  // Notification reads indexes (separate table)
  const hasNotificationReads = await knex.schema.hasTable('notification_reads');
  if (hasNotificationReads) {
    await addIndexIfNotExists('notification_reads', ['user_id', 'read_at'], 'idx_notification_reads_user_read');
  }

  // Blog posts indexes
  const hasPosts = await knex.schema.hasTable('posts');
  if (hasPosts) {
    await addIndexIfNotExists('posts', ['slug'], 'idx_posts_slug');
    await addIndexIfNotExists('posts', ['published_at'], 'idx_posts_published_at');
    await addIndexIfNotExists('posts', ['category'], 'idx_posts_category');
  }

  // User verification state indexes
  const hasVerificationState = await knex.schema.hasTable('user_verification_state');
  if (hasVerificationState) {
    await addIndexIfNotExists('user_verification_state', ['status'], 'idx_verification_state_status');
    await addIndexIfNotExists('user_verification_state', ['risk_level'], 'idx_verification_state_risk_level');
  }

  // Risk events indexes
  const hasRiskEvents = await knex.schema.hasTable('risk_events');
  if (hasRiskEvents) {
    await addIndexIfNotExists('risk_events', ['user_id', 'created_at'], 'idx_risk_events_user_created');
  }

  console.log('✓ Performance indexes migration complete');
};

exports.down = async function(knex) {
  // Helper to drop index if exists
  async function dropIndexIfExists(table, indexName) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) return;

    const hasIndex = await knex.raw(`
      SELECT COUNT(*) as count 
      FROM information_schema.statistics 
      WHERE table_schema = DATABASE() 
      AND table_name = ? 
      AND index_name = ?
    `, [table, indexName]).then(([rows]) => rows[0].count > 0);

    if (hasIndex) {
      await knex.schema.alterTable(table, (t) => {
        t.dropIndex([], indexName);
      });
      console.log(`✓ Dropped index ${indexName} from ${table}`);
    }
  }

  // Drop all indexes created in up()
  await dropIndexIfExists('quotations', 'idx_quotations_user_id');
  await dropIndexIfExists('quotations', 'idx_quotations_status');
  await dropIndexIfExists('quotations', 'idx_quotations_created_at');
  await dropIndexIfExists('quotations', 'idx_quotations_status_user');
  
  await dropIndexIfExists('kyc_submissions', 'idx_kyc_submissions_reviewer_id');
  await dropIndexIfExists('kyc_submissions', 'idx_kyc_submissions_status_created');
  
  await dropIndexIfExists('orders', 'idx_orders_user_id');
  await dropIndexIfExists('orders', 'idx_orders_status');
  await dropIndexIfExists('orders', 'idx_orders_created_at');
  
  await dropIndexIfExists('chat_messages', 'idx_chat_messages_thread_created');
  await dropIndexIfExists('chat_messages', 'idx_chat_messages_sender_id');
  
  await dropIndexIfExists('notifications', 'idx_notifications_user_created');
  await dropIndexIfExists('notification_reads', 'idx_notification_reads_user_read');
  
  await dropIndexIfExists('posts', 'idx_posts_slug');
  await dropIndexIfExists('posts', 'idx_posts_published_at');
  await dropIndexIfExists('posts', 'idx_posts_category');
  
  await dropIndexIfExists('user_verification_state', 'idx_verification_state_status');
  await dropIndexIfExists('user_verification_state', 'idx_verification_state_risk_level');
  
  await dropIndexIfExists('risk_events', 'idx_risk_events_user_created');

  console.log('✓ Performance indexes rollback complete');
};
