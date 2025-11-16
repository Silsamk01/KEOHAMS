const db = require('../config/db');

class SecurityService {
  /**
   * Log security audit event
   */
  static async logSecurityEvent(eventType, userId, metadata, req = null, severity = 'LOW') {
    const log = {
      user_id: userId,
      event_type: eventType,
      metadata: JSON.stringify(metadata),
      severity
    };

    if (req) {
      log.ip_address = req.ip || req.connection.remoteAddress;
      log.user_agent = req.headers['user-agent'];
    }

    await db('security_audit_log').insert(log);
  }

  /**
   * Record login attempt
   */
  static async recordLoginAttempt(email, ipAddress, success, failureReason = null) {
    await db('login_attempts').insert({
      email,
      ip_address: ipAddress,
      success,
      failure_reason: failureReason
    });

    if (!success) {
      await this.incrementFailedLoginAttempts(email, ipAddress);
    }
  }

  /**
   * Increment failed login attempts and lock account if threshold exceeded
   */
  static async incrementFailedLoginAttempts(email, ipAddress) {
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MINUTES = 30;

    const user = await db('users').where('email', email).first();
    if (!user) return;

    const failedAttempts = (user.failed_login_attempts || 0) + 1;

    await db('users')
      .where('id', user.id)
      .update({
        failed_login_attempts: failedAttempts,
        last_failed_login: db.fn.now()
      });

    if (failedAttempts >= MAX_ATTEMPTS) {
      const unlockAt = new Date();
      unlockAt.setMinutes(unlockAt.getMinutes() + LOCKOUT_DURATION_MINUTES);

      await db('users')
        .where('id', user.id)
        .update({
          is_locked: true,
          locked_until: unlockAt
        });

      await db('account_locks').insert({
        user_id: user.id,
        lock_type: 'FAILED_LOGIN',
        reason: `Account locked after ${MAX_ATTEMPTS} failed login attempts`,
        unlock_at: unlockAt
      });

      await this.logSecurityEvent(
        'ACCOUNT_LOCKED',
        user.id,
        { reason: 'Failed login attempts', ip_address: ipAddress },
        null,
        'HIGH'
      );
    }
  }

  /**
   * Reset failed login attempts on successful login
   */
  static async resetFailedLoginAttempts(userId) {
    await db('users')
      .where('id', userId)
      .update({
        failed_login_attempts: 0,
        last_failed_login: null,
        is_locked: false,
        locked_until: null
      });
  }

  /**
   * Check if account is locked
   */
  static async isAccountLocked(userId) {
    const user = await db('users')
      .where('id', userId)
      .first('is_locked', 'locked_until');

    if (!user) return false;

    // Auto-unlock if lockout period has expired
    if (user.is_locked && user.locked_until) {
      const now = new Date();
      const unlockTime = new Date(user.locked_until);

      if (now >= unlockTime) {
        await this.unlockAccount(userId, null, 'Auto-unlock after timeout');
        return false;
      }
    }

    return user.is_locked;
  }

  /**
   * Manually lock account
   */
  static async lockAccount(userId, lockType, reason, lockedBy, isPermanent = false, trx = null) {
    const dbConn = trx || db;

    await dbConn('users')
      .where('id', userId)
      .update({
        is_locked: true,
        locked_until: isPermanent ? null : db.raw('DATE_ADD(NOW(), INTERVAL 24 HOUR)')
      });

    await dbConn('account_locks').insert({
      user_id: userId,
      lock_type: lockType,
      reason,
      locked_by: lockedBy,
      is_permanent: isPermanent,
      unlock_at: isPermanent ? null : db.raw('DATE_ADD(NOW(), INTERVAL 24 HOUR)')
    });

    await this.logSecurityEvent(
      'ACCOUNT_LOCKED',
      userId,
      { lock_type: lockType, reason, locked_by: lockedBy },
      null,
      'CRITICAL'
    );
  }

  /**
   * Unlock account
   */
  static async unlockAccount(userId, unlockedBy, reason, trx = null) {
    const dbConn = trx || db;

    await dbConn('users')
      .where('id', userId)
      .update({
        is_locked: false,
        locked_until: null,
        failed_login_attempts: 0
      });

    await dbConn('account_locks')
      .where('user_id', userId)
      .whereNull('unlocked_at')
      .update({
        unlocked_at: dbConn.fn.now(),
        unlocked_by: unlockedBy
      });

    await this.logSecurityEvent(
      'ACCOUNT_UNLOCKED',
      userId,
      { reason, unlocked_by: unlockedBy },
      null,
      'MEDIUM'
    );
  }

  /**
   * Create GDPR data export request
   */
  static async createDataExportRequest(userId, trx = null) {
    const dbConn = trx || db;

    const [requestId] = await dbConn('gdpr_data_requests').insert({
      user_id: userId,
      request_type: 'DATA_EXPORT',
      status: 'PENDING'
    });

    await this.logSecurityEvent(
      'DATA_EXPORT',
      userId,
      { request_id: requestId },
      null,
      'MEDIUM'
    );

    return { request_id: requestId };
  }

  /**
   * Create GDPR data deletion request
   */
  static async createDataDeletionRequest(userId, notes, trx = null) {
    const dbConn = trx || db;

    const [requestId] = await dbConn('gdpr_data_requests').insert({
      user_id: userId,
      request_type: 'DATA_DELETE',
      status: 'PENDING',
      notes
    });

    await this.logSecurityEvent(
      'DATA_DELETE',
      userId,
      { request_id: requestId },
      null,
      'CRITICAL'
    );

    return { request_id: requestId };
  }

  /**
   * Process data export (generates user data package)
   */
  static async processDataExport(requestId, processedBy) {
    const request = await db('gdpr_data_requests')
      .where('id', requestId)
      .first();

    if (!request) throw new Error('Request not found');

    // Gather all user data
    const userData = {
      user: await db('users').where('id', request.user_id).first(),
      orders: await db('orders').where('user_id', request.user_id),
      addresses: await db('addresses').where('user_id', request.user_id),
      wishlist: await db('wishlists').where('user_id', request.user_id),
      reviews: await db('product_reviews').where('user_id', request.user_id),
      support_tickets: await db('support_tickets').where('user_id', request.user_id),
      affiliate_data: await db('affiliates').where('user_id', request.user_id).first()
    };

    // In production, this would generate a file and upload to secure storage
    const exportFileUrl = `/exports/user_${request.user_id}_${Date.now()}.json`;

    await db('gdpr_data_requests')
      .where('id', requestId)
      .update({
        status: 'COMPLETED',
        export_file_url: exportFileUrl,
        completed_at: db.fn.now(),
        processed_by: processedBy
      });

    return { export_file_url: exportFileUrl, data: userData };
  }

  /**
   * Get security audit log for user
   */
  static async getUserAuditLog(userId, limit = 50, offset = 0) {
    const logs = await db('security_audit_log')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await db('security_audit_log')
      .where('user_id', userId)
      .count('* as count')
      .first();

    return {
      logs,
      total: total.count,
      limit,
      offset
    };
  }

  /**
   * Detect suspicious activity
   */
  static async detectSuspiciousActivity(userId, req) {
    // Example: Multiple failed payments, unusual IP changes, etc.
    const recentLogs = await db('security_audit_log')
      .where('user_id', userId)
      .where('created_at', '>', db.raw('DATE_SUB(NOW(), INTERVAL 1 HOUR)'))
      .where('event_type', 'LOGIN_FAILED')
      .count('* as count')
      .first();

    if (recentLogs.count >= 3) {
      await this.logSecurityEvent(
        'SUSPICIOUS_ACTIVITY',
        userId,
        { reason: 'Multiple failed logins in short time', failed_count: recentLogs.count },
        req,
        'HIGH'
      );

      return true;
    }

    return false;
  }
}

module.exports = SecurityService;
