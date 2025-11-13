const db = require('../config/db');

const TABLE = 'affiliate_sales';

/**
 * Create a new affiliate sale
 */
async function create(saleData) {
  const {
    affiliate_id,
    customer_id = null,
    sale_reference,
    sale_amount,
    payment_method,
    payment_details = null
  } = saleData;
  
  // Check if sale reference already exists
  const existing = await db(TABLE).where({ sale_reference }).first();
  if (existing) {
    throw new Error('Sale reference already exists');
  }
  
  const sale = {
    affiliate_id,
    customer_id,
    sale_reference,
    sale_amount: Number(sale_amount),
    payment_method,
    payment_details,
    verification_status: 'PENDING',
    commissions_paid: false
  };
  
  const [id] = await db(TABLE).insert(sale);
  return { id, ...sale };
}

/**
 * Find sale by ID
 */
async function findById(id) {
  return db(TABLE)
    .select(
      'affiliate_sales.*',
      'affiliates.referral_code',
      'seller.name as seller_name',
      'seller.email as seller_email',
      'customer.name as customer_name',
      'customer.email as customer_email',
      'verifier.name as verifier_name'
    )
    .leftJoin('affiliates', 'affiliate_sales.affiliate_id', 'affiliates.id')
    .leftJoin('users as seller', 'affiliates.user_id', 'seller.id')
    .leftJoin('users as customer', 'affiliate_sales.customer_id', 'customer.id')
    .leftJoin('users as verifier', 'affiliate_sales.verified_by', 'verifier.id')
    .where('affiliate_sales.id', id)
    .first();
}

/**
 * Find sale by reference
 */
async function findByReference(sale_reference) {
  return db(TABLE)
    .select('affiliate_sales.*', 'affiliates.referral_code', 'users.name as seller_name')
    .leftJoin('affiliates', 'affiliate_sales.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliate_sales.sale_reference', sale_reference)
    .first();
}

/**
 * List sales with filters and pagination
 */
async function list(options = {}) {
  const { 
    page = 1, 
    pageSize = 20, 
    affiliate_id = null,
    verification_status = null,
    commissions_paid = null,
    search = ''
  } = options;
  
  let query = db(TABLE)
    .select(
      'affiliate_sales.*',
      'affiliates.referral_code',
      'users.name as seller_name',
      'users.email as seller_email',
      'customer.name as customer_name'
    )
    .leftJoin('affiliates', 'affiliate_sales.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .leftJoin('users as customer', 'affiliate_sales.customer_id', 'customer.id');
  
  if (affiliate_id) {
    query = query.where('affiliate_sales.affiliate_id', affiliate_id);
  }
  
  if (verification_status) {
    query = query.where('affiliate_sales.verification_status', verification_status);
  }
  
  if (typeof commissions_paid === 'boolean') {
    query = query.where('affiliate_sales.commissions_paid', commissions_paid);
  }
  
  if (search) {
    query = query.where(function() {
      this.whereILike('affiliate_sales.sale_reference', `%${search}%`)
          .orWhereILike('users.name', `%${search}%`)
          .orWhereILike('customer.name', `%${search}%`);
    });
  }
  
  const offset = (page - 1) * pageSize;
  const data = await query.clone()
    .orderBy('affiliate_sales.created_at', 'desc')
    .offset(offset)
    .limit(pageSize);
  
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
 * Update sale verification status
 */
async function updateVerificationStatus(id, status, verified_by = null, notes = null) {
  const updates = {
    verification_status: status,
    verified_by,
    verification_notes: notes
  };
  
  if (status === 'VERIFIED' || status === 'REJECTED') {
    updates.verified_at = new Date();
  }
  
  await db(TABLE).where({ id }).update(updates);
  return findById(id);
}

/**
 * Mark commissions as paid
 */
async function markCommissionsPaid(id) {
  await db(TABLE).where({ id }).update({
    commissions_paid: true,
    commissions_paid_at: new Date()
  });
}

/**
 * Get unverified sales pending admin approval
 */
async function getPendingVerification() {
  return db(TABLE)
    .select(
      'affiliate_sales.*',
      'affiliates.referral_code',
      'users.name as seller_name',
      'users.email as seller_email'
    )
    .leftJoin('affiliates', 'affiliate_sales.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliate_sales.verification_status', 'PENDING')
    .orderBy('affiliate_sales.created_at', 'asc');
}

/**
 * Get verified sales without commissions paid
 */
async function getVerifiedUnpaidSales() {
  return db(TABLE)
    .select('affiliate_sales.*', 'affiliates.referral_code')
    .leftJoin('affiliates', 'affiliate_sales.affiliate_id', 'affiliates.id')
    .where('affiliate_sales.verification_status', 'VERIFIED')
    .andWhere('affiliate_sales.commissions_paid', false)
    .orderBy('affiliate_sales.verified_at', 'asc');
}

/**
 * Get sales statistics for an affiliate
 */
async function getAffiliateStats(affiliate_id) {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_sales'),
      db.raw('SUM(sale_amount) as total_amount'),
      db.raw('COUNT(CASE WHEN verification_status = "VERIFIED" THEN 1 END) as verified_sales'),
      db.raw('SUM(CASE WHEN verification_status = "VERIFIED" THEN sale_amount ELSE 0 END) as verified_amount'),
      db.raw('COUNT(CASE WHEN verification_status = "PENDING" THEN 1 END) as pending_sales'),
      db.raw('SUM(CASE WHEN verification_status = "PENDING" THEN sale_amount ELSE 0 END) as pending_amount'),
      db.raw('COUNT(CASE WHEN commissions_paid = true THEN 1 END) as paid_sales'),
      db.raw('SUM(CASE WHEN commissions_paid = true THEN sale_amount ELSE 0 END) as paid_amount')
    )
    .where({ affiliate_id })
    .first();
  
  return {
    total_sales: Number(stats.total_sales || 0),
    total_amount: Number(stats.total_amount || 0),
    verified_sales: Number(stats.verified_sales || 0),
    verified_amount: Number(stats.verified_amount || 0),
    pending_sales: Number(stats.pending_sales || 0),
    pending_amount: Number(stats.pending_amount || 0),
    paid_sales: Number(stats.paid_sales || 0),
    paid_amount: Number(stats.paid_amount || 0)
  };
}

/**
 * Get system-wide sales statistics
 */
async function getSystemStats() {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_sales'),
      db.raw('SUM(sale_amount) as total_amount'),
      db.raw('COUNT(CASE WHEN verification_status = "VERIFIED" THEN 1 END) as verified_sales'),
      db.raw('SUM(CASE WHEN verification_status = "VERIFIED" THEN sale_amount ELSE 0 END) as verified_amount'),
      db.raw('COUNT(CASE WHEN verification_status = "PENDING" THEN 1 END) as pending_sales'),
      db.raw('COUNT(CASE WHEN verification_status = "REJECTED" THEN 1 END) as rejected_sales')
    )
    .first();
  
  return {
    total_sales: Number(stats.total_sales || 0),
    total_amount: Number(stats.total_amount || 0),
    verified_sales: Number(stats.verified_sales || 0),
    verified_amount: Number(stats.verified_amount || 0),
    pending_sales: Number(stats.pending_sales || 0),
    rejected_sales: Number(stats.rejected_sales || 0)
  };
}

module.exports = {
  TABLE,
  create,
  findById,
  findByReference,
  list,
  updateVerificationStatus,
  markCommissionsPaid,
  getPendingVerification,
  getVerifiedUnpaidSales,
  getAffiliateStats,
  getSystemStats
};