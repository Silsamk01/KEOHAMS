const SecurityService = require('../services/securityService');

/**
 * Get user's security audit log
 */
exports.getAuditLog = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await SecurityService.getUserAuditLog(userId, limit, offset);
    return res.json(result);
  } catch (error) {
    console.error('Get audit log error:', error);
    return res.status(500).json({ message: 'Failed to retrieve audit log' });
  }
};

/**
 * Request GDPR data export
 */
exports.requestDataExport = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await SecurityService.createDataExportRequest(userId);
    
    return res.json({ 
      message: 'Data export request created. You will receive your data within 30 days.',
      request_id: result.request_id
    });
  } catch (error) {
    console.error('Data export request error:', error);
    return res.status(500).json({ message: 'Failed to create data export request' });
  }
};

/**
 * Request GDPR data deletion
 */
exports.requestDataDeletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notes } = req.body;
    
    const result = await SecurityService.createDataDeletionRequest(userId, notes);
    
    return res.json({ 
      message: 'Data deletion request created. Your account will be reviewed for deletion.',
      request_id: result.request_id
    });
  } catch (error) {
    console.error('Data deletion request error:', error);
    return res.status(500).json({ message: 'Failed to create data deletion request' });
  }
};

/**
 * Admin: Process GDPR data export
 */
exports.processDataExport = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { request_id } = req.params;
    const result = await SecurityService.processDataExport(request_id, req.user.id);
    
    return res.json({ 
      message: 'Data export completed',
      export_url: result.export_file_url,
      data: result.data
    });
  } catch (error) {
    console.error('Process data export error:', error);
    return res.status(500).json({ message: error.message || 'Failed to process data export' });
  }
};

/**
 * Admin: Lock user account
 */
exports.lockAccount = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { user_id } = req.params;
    const { lock_type, reason, is_permanent } = req.body;

    if (!lock_type || !reason) {
      return res.status(400).json({ message: 'lock_type and reason are required' });
    }

    await SecurityService.lockAccount(
      user_id,
      lock_type,
      reason,
      req.user.id,
      is_permanent || false
    );

    return res.json({ message: 'Account locked successfully' });
  } catch (error) {
    console.error('Lock account error:', error);
    return res.status(500).json({ message: 'Failed to lock account' });
  }
};

/**
 * Admin: Unlock user account
 */
exports.unlockAccount = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { user_id } = req.params;
    const { reason } = req.body;

    await SecurityService.unlockAccount(user_id, req.user.id, reason || 'Admin unlock');

    return res.json({ message: 'Account unlocked successfully' });
  } catch (error) {
    console.error('Unlock account error:', error);
    return res.status(500).json({ message: 'Failed to unlock account' });
  }
};

/**
 * Admin: View all security events
 */
exports.getAllSecurityEvents = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const db = require('../config/db');
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const severity = req.query.severity;

    let query = db('security_audit_log')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (severity) {
      query = query.where('severity', severity);
    }

    const events = await query;
    const total = await db('security_audit_log').count('* as count').first();

    return res.json({
      events,
      total: total.count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get all security events error:', error);
    return res.status(500).json({ message: 'Failed to retrieve security events' });
  }
};

/**
 * Admin: View all login attempts
 */
exports.getLoginAttempts = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const db = require('../config/db');
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const email = req.query.email;

    let query = db('login_attempts')
      .orderBy('attempted_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (email) {
      query = query.where('email', 'like', `%${email}%`);
    }

    const attempts = await query;
    const total = await db('login_attempts').count('* as count').first();

    return res.json({
      attempts,
      total: total.count,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get login attempts error:', error);
    return res.status(500).json({ message: 'Failed to retrieve login attempts' });
  }
};
