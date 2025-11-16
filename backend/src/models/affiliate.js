const db = require('../config/db');
const crypto = require('crypto');

const TABLE = 'affiliates';

/**
 * Generate a unique referral code
 */
function generateReferralCode() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Create a new affiliate
 */
async function create(affiliateData) {
  const { user_id, parent_affiliate_id = null } = affiliateData;
  
  // Generate unique referral code
  let referral_code;
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 10) {
    referral_code = generateReferralCode();
    const existing = await db(TABLE).where({ referral_code }).first();
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error('Failed to generate unique referral code');
  }
  
  const affiliate = {
    user_id,
    parent_affiliate_id,
    referral_code,
    total_earnings: 0,
    available_balance: 0,
    pending_balance: 0,
    direct_referrals: 0,
    total_downline: 0,
    is_active: true
  };
  
  const [id] = await db(TABLE).insert(affiliate);
  
  // Update parent's direct referrals count
  if (parent_affiliate_id) {
    await db(TABLE)
      .where({ id: parent_affiliate_id })
      .increment('direct_referrals', 1);
    
    // Update all upline total_downline counts
    await updateUplineDownlineCounts(parent_affiliate_id);
  }
  
  return { id, ...affiliate };
}

/**
 * Find affiliate by ID
 */
async function findById(id) {
  const affiliate = await db(TABLE)
    .select('affiliates.*', 'users.name as user_name', 'users.email as user_email')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliates.id', id)
    .first();
  
  // Use affiliate's own name/email if standalone, otherwise use user's
  if (affiliate) {
    affiliate.name = affiliate.name || affiliate.user_name;
    affiliate.email = affiliate.email || affiliate.user_email;
  }
  
  return affiliate;
}

/**
 * Find affiliate by user ID
 */
async function findByUserId(user_id) {
  return db(TABLE)
    .select('affiliates.*', 'users.name as user_name', 'users.email as user_email')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliates.user_id', user_id)
    .first();
}

/**
 * Find affiliate by email
 */
async function findByEmail(email) {
  return db(TABLE)
    .where({ email: email.toLowerCase().trim() })
    .whereNull('deleted_at')
    .first();
}

/**
 * Find affiliate by referral code
 */
async function findByReferralCode(referral_code) {
  const affiliate = await db(TABLE)
    .select('affiliates.*', 'users.name as user_name', 'users.email as user_email')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliates.referral_code', referral_code)
    .first();
  
  // Use affiliate's own name/email if standalone, otherwise use user's
  if (affiliate) {
    affiliate.name = affiliate.name || affiliate.user_name;
    affiliate.email = affiliate.email || affiliate.user_email;
  }
  
  return affiliate;
}

/**
 * Get affiliate's upline chain (all parents)
 * Limited to 2 levels max for commission calculation (level 1 and level 2)
 */
async function getUplineChain(affiliate_id, maxLevels = 2) {
  const upline = [];
  let current_id = affiliate_id;
  let levelCount = 0;
  
  while (current_id && levelCount < maxLevels) {
    const affiliate = await db(TABLE)
      .select('affiliates.id', 'affiliates.user_id', 'affiliates.parent_affiliate_id', 'affiliates.referral_code', 'users.name', 'users.email')
      .leftJoin('users', 'affiliates.user_id', 'users.id')
      .where('affiliates.id', current_id)
      .first();
    
    if (!affiliate) break;
    
    if (affiliate.id !== affiliate_id) { // Don't include self
      upline.push(affiliate);
      levelCount++;
    }
    
    current_id = affiliate.parent_affiliate_id;
  }
  
  return upline;
}

/**
 * Get affiliate's downline (direct and indirect referrals)
 */
async function getDownline(affiliate_id, level = 0, max_levels = 10) {
  if (level >= max_levels) return [];
  
  const direct = await db(TABLE)
    .select('affiliates.*', 'users.name', 'users.email')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('affiliates.parent_affiliate_id', affiliate_id)
    .orderBy('affiliates.created_at', 'desc');
  
  const downline = [];
  
  for (const affiliate of direct) {
    const affiliateWithLevel = { ...affiliate, level: level + 1 };
    downline.push(affiliateWithLevel);
    
    // Recursively get their downline
    const subDownline = await getDownline(affiliate.id, level + 1, max_levels);
    downline.push(...subDownline);
  }
  
  return downline;
}

/**
 * Update upline downline counts
 */
async function updateUplineDownlineCounts(affiliate_id) {
  const upline = await getUplineChain(affiliate_id);
  
  for (const parent of upline) {
    const totalDownline = await countTotalDownline(parent.id);
    await db(TABLE)
      .where({ id: parent.id })
      .update({ total_downline: totalDownline });
  }
}

/**
 * Count total downline for an affiliate
 */
async function countTotalDownline(affiliate_id) {
  const downline = await getDownline(affiliate_id);
  return downline.length;
}

/**
 * Update affiliate balances
 */
async function updateBalances(affiliate_id, changes) {
  const { total_earnings, available_balance, pending_balance } = changes;
  const updates = {};
  
  if (typeof total_earnings === 'number') {
    updates.total_earnings = total_earnings;
  }
  if (typeof available_balance === 'number') {
    updates.available_balance = available_balance;
  }
  if (typeof pending_balance === 'number') {
    updates.pending_balance = pending_balance;
  }
  
  if (Object.keys(updates).length > 0) {
    await db(TABLE).where({ id: affiliate_id }).update(updates);
  }
}

/**
 * List affiliates with pagination and search
 */
async function list(options = {}) {
  const { page = 1, pageSize = 20, search = '', status = 'all' } = options;
  
  let query = db(TABLE)
    .select('affiliates.*', 'users.name', 'users.email')
    .leftJoin('users', 'affiliates.user_id', 'users.id');
  
  if (search) {
    query = query.where(function() {
      this.whereILike('users.name', `%${search}%`)
          .orWhereILike('users.email', `%${search}%`)
          .orWhereILike('affiliates.referral_code', `%${search}%`);
    });
  }
  
  if (status !== 'all') {
    query = query.where('affiliates.is_active', status === 'active');
  }
  
  const offset = (page - 1) * pageSize;
  const data = await query.clone()
    .orderBy('affiliates.created_at', 'desc')
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
 * Get affiliate statistics
 */
async function getStats(affiliate_id) {
  const affiliate = await findById(affiliate_id);
  if (!affiliate) return null;
  
  // Get sales statistics
  const salesStats = await db('affiliate_sales')
    .select(
      db.raw('COUNT(*) as total_sales'),
      db.raw('SUM(sale_amount) as total_sales_amount'),
      db.raw('COUNT(CASE WHEN verification_status = "VERIFIED" THEN 1 END) as verified_sales'),
      db.raw('SUM(CASE WHEN verification_status = "VERIFIED" THEN sale_amount ELSE 0 END) as verified_sales_amount')
    )
    .where({ affiliate_id })
    .first();
  
  // Get commission statistics
  const commissionStats = await db('commission_records')
    .select(
      db.raw('COUNT(*) as total_commissions'),
      db.raw('SUM(commission_amount) as total_commission_amount'),
      db.raw('COUNT(CASE WHEN status = "PAID" THEN 1 END) as paid_commissions'),
      db.raw('SUM(CASE WHEN status = "PAID" THEN commission_amount ELSE 0 END) as paid_commission_amount')
    )
    .where({ affiliate_id })
    .first();
  
  return {
    affiliate,
    sales: {
      total_count: Number(salesStats.total_sales || 0),
      total_amount: Number(salesStats.total_sales_amount || 0),
      verified_count: Number(salesStats.verified_sales || 0),
      verified_amount: Number(salesStats.verified_sales_amount || 0)
    },
    commissions: {
      total_count: Number(commissionStats.total_commissions || 0),
      total_amount: Number(commissionStats.total_commission_amount || 0),
      paid_count: Number(commissionStats.paid_commissions || 0),
      paid_amount: Number(commissionStats.paid_commission_amount || 0)
    },
    network: {
      direct_referrals: affiliate.direct_referrals,
      total_downline: affiliate.total_downline
    }
  };
}

module.exports = {
  TABLE,
  create,
  findById,
  findByUserId,
  findByEmail,
  findByReferralCode,
  getUplineChain,
  getDownline,
  updateUplineDownlineCounts,
  countTotalDownline,
  updateBalances,
  list,
  getStats,
  generateReferralCode
};