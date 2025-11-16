const db = require('../config/db');

const TABLE = 'affiliate_withdrawals';

/**
 * Create a new withdrawal request
 */
async function create(withdrawalData) {
  const {
    affiliate_id,
    amount,
    method,
    payment_details
  } = withdrawalData;
  
  // Validate payment details based on method
  if (!payment_details || typeof payment_details !== 'object') {
    throw new Error('Payment details required');
  }
  
  const withdrawal = {
    affiliate_id,
    amount: Number(amount),
    method,
    payment_details: JSON.stringify(payment_details),
    status: 'PENDING'
  };
  
  const [id] = await db(TABLE).insert(withdrawal);
  return { id, ...withdrawal, payment_details };
}

/**
 * Find withdrawal by ID
 */
async function findById(id) {
  const withdrawal = await db(TABLE)
    .select(
      'affiliate_withdrawals.*',
      'affiliates.referral_code',
      'users.name as affiliate_name',
      'users.email as affiliate_email',
      'processor.name as processor_name'
    )
    .leftJoin('affiliates', 'affiliate_withdrawals.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .leftJoin('users as processor', 'affiliate_withdrawals.processed_by', 'processor.id')
    .where('affiliate_withdrawals.id', id)
    .first();
  
  if (withdrawal && withdrawal.payment_details) {
    try {
      withdrawal.payment_details = JSON.parse(withdrawal.payment_details);
    } catch (e) {
      // Already parsed or invalid JSON
    }
  }
  
  return withdrawal;
}

/**
 * List withdrawals with filters and pagination
 */
async function list(options = {}) {
  const {
    page = 1,
    pageSize = 20,
    affiliate_id = null,
    status = null,
    method = null,
    search = ''
  } = options;
  
  let query = db(TABLE)
    .select(
      'affiliate_withdrawals.*',
      'affiliates.referral_code',
      'users.name as affiliate_name',
      'users.email as affiliate_email'
    )
    .leftJoin('affiliates', 'affiliate_withdrawals.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id');
  
  if (affiliate_id) {
    query = query.where('affiliate_withdrawals.affiliate_id', affiliate_id);
  }
  
  if (status) {
    query = query.where('affiliate_withdrawals.status', status);
  }
  
  if (method) {
    query = query.where('affiliate_withdrawals.method', method);
  }
  
  if (search) {
    query = query.where(function() {
      this.whereILike('users.name', `%${search}%`)
          .orWhereILike('users.email', `%${search}%`)
          .orWhereILike('affiliate_withdrawals.transaction_reference', `%${search}%`);
    });
  }
  
  const offset = (page - 1) * pageSize;
  const data = await query.clone()
    .orderBy('affiliate_withdrawals.created_at', 'desc')
    .offset(offset)
    .limit(pageSize);
  
  // Parse payment_details JSON
  data.forEach(item => {
    if (item.payment_details) {
      try {
        item.payment_details = JSON.parse(item.payment_details);
      } catch (e) {
        // Already parsed or invalid
      }
    }
  });
  
  const [{ count }] = await query.clone().count({ count: '*' });
  
  return {
    data,
    total: Number(count || 0),
    page,
    pageSize,
    totalPages: Math.ceil(Number(count || 0) / pageSize)
  };
}

/**
 * Update withdrawal status
 */
async function updateStatus(id, status, processed_by = null, processing_notes = null, transaction_reference = null) {
  const updates = {
    status,
    processed_by,
    processing_notes
  };
  
  if (transaction_reference) {
    updates.transaction_reference = transaction_reference;
  }
  
  if (status === 'PROCESSING' || status === 'COMPLETED' || status === 'CANCELLED') {
    updates.processed_at = new Date();
  }
  
  await db(TABLE).where({ id }).update(updates);
  return findById(id);
}

/**
 * Get withdrawals for an affiliate
 */
async function getAffiliateWithdrawals(affiliate_id, options = {}) {
  return list({
    ...options,
    affiliate_id
  });
}

/**
 * Get pending withdrawals awaiting processing
 */
async function getPendingWithdrawals() {
  const withdrawals = await db(TABLE)
    .select(
      'affiliate_withdrawals.*',
      'affiliates.referral_code',
      'users.name as affiliate_name',
      'users.email as affiliate_email',
      'affiliates.available_balance'
    )
    .leftJoin('affiliates', 'affiliate_withdrawals.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliate_withdrawals.status', 'PENDING')
    .orderBy('affiliate_withdrawals.created_at', 'asc');
  
  // Parse payment_details
  withdrawals.forEach(item => {
    if (item.payment_details) {
      try {
        item.payment_details = JSON.parse(item.payment_details);
      } catch (e) {
        // Already parsed or invalid
      }
    }
  });
  
  return withdrawals;
}

/**
 * Get withdrawal statistics for an affiliate
 */
async function getAffiliateWithdrawalStats(affiliate_id) {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_withdrawals'),
      db.raw('SUM(amount) as total_amount'),
      db.raw('COUNT(CASE WHEN status = "COMPLETED" THEN 1 END) as completed_withdrawals'),
      db.raw('SUM(CASE WHEN status = "COMPLETED" THEN amount ELSE 0 END) as completed_amount'),
      db.raw('COUNT(CASE WHEN status = "PENDING" THEN 1 END) as pending_withdrawals'),
      db.raw('SUM(CASE WHEN status = "PENDING" THEN amount ELSE 0 END) as pending_amount'),
      db.raw('COUNT(CASE WHEN status = "PROCESSING" THEN 1 END) as processing_withdrawals'),
      db.raw('SUM(CASE WHEN status = "PROCESSING" THEN amount ELSE 0 END) as processing_amount')
    )
    .where({ affiliate_id })
    .first();
  
  return {
    total_withdrawals: Number(stats.total_withdrawals || 0),
    total_amount: Number(stats.total_amount || 0),
    completed_withdrawals: Number(stats.completed_withdrawals || 0),
    completed_amount: Number(stats.completed_amount || 0),
    pending_withdrawals: Number(stats.pending_withdrawals || 0),
    pending_amount: Number(stats.pending_amount || 0),
    processing_withdrawals: Number(stats.processing_withdrawals || 0),
    processing_amount: Number(stats.processing_amount || 0)
  };
}

/**
 * Get system-wide withdrawal statistics
 */
async function getSystemWithdrawalStats() {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_withdrawals'),
      db.raw('SUM(amount) as total_amount'),
      db.raw('COUNT(CASE WHEN status = "PENDING" THEN 1 END) as pending_withdrawals'),
      db.raw('SUM(CASE WHEN status = "PENDING" THEN amount ELSE 0 END) as pending_amount'),
      db.raw('COUNT(CASE WHEN status = "PROCESSING" THEN 1 END) as processing_withdrawals'),
      db.raw('SUM(CASE WHEN status = "PROCESSING" THEN amount ELSE 0 END) as processing_amount'),
      db.raw('COUNT(CASE WHEN status = "COMPLETED" THEN 1 END) as completed_withdrawals'),
      db.raw('SUM(CASE WHEN status = "COMPLETED" THEN amount ELSE 0 END) as completed_amount')
    )
    .first();
  
  return {
    total_withdrawals: Number(stats.total_withdrawals || 0),
    total_amount: Number(stats.total_amount || 0),
    pending_withdrawals: Number(stats.pending_withdrawals || 0),
    pending_amount: Number(stats.pending_amount || 0),
    processing_withdrawals: Number(stats.processing_withdrawals || 0),
    processing_amount: Number(stats.processing_amount || 0),
    completed_withdrawals: Number(stats.completed_withdrawals || 0),
    completed_amount: Number(stats.completed_amount || 0)
  };
}

/**
 * Check if affiliate has sufficient balance for withdrawal
 */
async function validateWithdrawalAmount(affiliate_id, amount) {
  const Affiliate = require('./affiliate');
  const affiliate = await Affiliate.findById(affiliate_id);
  
  if (!affiliate) {
    throw new Error('Affiliate not found');
  }
  
  if (parseFloat(amount) > parseFloat(affiliate.available_balance)) {
    throw new Error('Insufficient balance for withdrawal');
  }
  
  if (parseFloat(amount) <= 0) {
    throw new Error('Withdrawal amount must be greater than 0');
  }
  
  return true;
}

module.exports = {
  TABLE,
  create,
  findById,
  list,
  updateStatus,
  getAffiliateWithdrawals,
  getPendingWithdrawals,
  getAffiliateWithdrawalStats,
  getSystemWithdrawalStats,
  validateWithdrawalAmount
};

