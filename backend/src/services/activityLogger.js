const db = require('../config/db');

/**
 * Log user activity
 * @param {Object} params
 * @param {number|null} params.user_id - User ID (null for system actions)
 * @param {string} params.user_type - ADMIN, USER, or AFFILIATE
 * @param {string} params.action - Action performed (LOGIN, CREATE_PRODUCT, etc.)
 * @param {string} [params.entity_type] - Type of entity affected (product, user, order, etc.)
 * @param {number} [params.entity_id] - ID of entity affected
 * @param {string} [params.description] - Human-readable description
 * @param {Object} [params.metadata] - Additional context
 * @param {string} [params.ip_address] - IP address
 * @param {string} [params.user_agent] - User agent string
 */
async function logActivity({
  user_id,
  user_type,
  action,
  entity_type = null,
  entity_id = null,
  description = null,
  metadata = null,
  ip_address = null,
  user_agent = null
}) {
  try {
    await db('activity_logs').insert({
      user_id,
      user_type,
      action,
      entity_type,
      entity_id,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip_address,
      user_agent
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break application flow
  }
}

/**
 * Get recent activities with pagination and filters
 */
async function getActivities({
  user_type = null,
  action = null,
  entity_type = null,
  user_id = null,
  limit = 50,
  offset = 0,
  start_date = null,
  end_date = null
} = {}) {
  let query = db('activity_logs as al')
    .leftJoin('users as u', 'u.id', 'al.user_id')
    .select(
      'al.*',
      'u.name as user_name',
      'u.email as user_email'
    )
    .orderBy('al.created_at', 'desc')
    .limit(limit)
    .offset(offset);
  
  if (user_type) query = query.where('al.user_type', user_type);
  if (action) query = query.where('al.action', action);
  if (entity_type) query = query.where('al.entity_type', entity_type);
  if (user_id) query = query.where('al.user_id', user_id);
  if (start_date) query = query.where('al.created_at', '>=', start_date);
  if (end_date) query = query.where('al.created_at', '<=', end_date);
  
  const activities = await query;
  
  // Parse metadata JSON
  return activities.map(a => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : null
  }));
}

/**
 * Get activity statistics
 */
async function getActivityStats({ hours = 24 } = {}) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  
  const [adminCount, userCount, affiliateCount, totalCount] = await Promise.all([
    db('activity_logs').where('user_type', 'ADMIN').where('created_at', '>=', since).count('* as count').first(),
    db('activity_logs').where('user_type', 'USER').where('created_at', '>=', since).count('* as count').first(),
    db('activity_logs').where('user_type', 'AFFILIATE').where('created_at', '>=', since).count('* as count').first(),
    db('activity_logs').where('created_at', '>=', since).count('* as count').first()
  ]);
  
  // Top actions in last 24 hours
  const topActions = await db('activity_logs')
    .select('action', db.raw('COUNT(*) as count'))
    .where('created_at', '>=', since)
    .groupBy('action')
    .orderBy('count', 'desc')
    .limit(10);
  
  return {
    admin_activities: adminCount?.count || 0,
    user_activities: userCount?.count || 0,
    affiliate_activities: affiliateCount?.count || 0,
    total_activities: totalCount?.count || 0,
    top_actions: topActions,
    period_hours: hours
  };
}

/**
 * Get activity count
 */
async function getActivityCount(filters = {}) {
  let query = db('activity_logs').count('* as count');
  
  if (filters.user_type) query = query.where('user_type', filters.user_type);
  if (filters.action) query = query.where('action', filters.action);
  if (filters.entity_type) query = query.where('entity_type', filters.entity_type);
  if (filters.user_id) query = query.where('user_id', filters.user_id);
  if (filters.start_date) query = query.where('created_at', '>=', filters.start_date);
  if (filters.end_date) query = query.where('created_at', '<=', filters.end_date);
  
  const result = await query.first();
  return result?.count || 0;
}

module.exports = {
  logActivity,
  getActivities,
  getActivityStats,
  getActivityCount
};
