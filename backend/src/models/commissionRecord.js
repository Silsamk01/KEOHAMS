const db = require('../config/db');

const TABLE = 'commission_records';

/**
 * Create commission records for a sale
 */
async function createCommissionsForSale(sale_id, affiliate_id, sale_amount) {
  // DUPLICATE PREVENTION: Check if commissions already exist
  const existing = await db(TABLE).where({ sale_id }).first();
  if (existing) {
    throw new Error(`Commission records already exist for sale ${sale_id}`);
  }
  
  // Get commission settings
  const settings = await db('commission_settings')
    .where({ is_active: true })
    .orderBy('level', 'asc');
  
  if (!settings.length) {
    throw new Error('No commission settings found');
  }
  
  // Get affiliate upline chain
  const Affiliate = require('./affiliate');
  const uplineChain = await Affiliate.getUplineChain(affiliate_id);
  
  // Add the direct seller at level 0
  const directSeller = await Affiliate.findById(affiliate_id);
  const hierarchy = [directSeller, ...uplineChain];
  
  const commissions = [];
  let totalCommissionRate = 0;
  const maxTotalRate = settings[0]?.max_total_rate || 25.00;
  
  // Calculate commissions for each level
  for (let level = 0; level < hierarchy.length && level < settings.length; level++) {
    const affiliate = hierarchy[level];
    const setting = settings[level];
    
    // Check if we've exceeded the maximum total commission rate
    if (totalCommissionRate + setting.rate > maxTotalRate) {
      const remainingRate = maxTotalRate - totalCommissionRate;
      if (remainingRate > 0) {
        // Apply the remaining rate
        const commission = {
          sale_id,
          affiliate_id: affiliate.id,
          level,
          commission_rate: remainingRate,
          commission_amount: (sale_amount * remainingRate) / 100,
          status: 'PENDING'
        };
        commissions.push(commission);
        totalCommissionRate += remainingRate;
      }
      break; // Stop processing further levels
    }
    
    const commission = {
      sale_id,
      affiliate_id: affiliate.id,
      level,
      commission_rate: setting.rate,
      commission_amount: (sale_amount * setting.rate) / 100,
      status: 'PENDING'
    };
    
    commissions.push(commission);
    totalCommissionRate += setting.rate;
  }
  
  // Insert all commissions in a transaction
  if (commissions.length > 0) {
    const inserted = await db.transaction(async (trx) => {
      // Final duplicate check within transaction
      const existingInTrx = await trx(TABLE).where({ sale_id }).first();
      if (existingInTrx) {
        throw new Error(`Commission records already exist for sale ${sale_id} (transaction check)`);
      }
      
      const ids = await trx(TABLE).insert(commissions);
      
      // Log the commission creation
      console.log(`Created ${commissions.length} commission records for sale ${sale_id}, total rate: ${totalCommissionRate}%`);
      
      return commissions.map((comm, index) => ({ ...comm, id: ids[0] + index }));
    });
    
    return inserted;
  }
  
  return commissions;
}

/**
 * Get commissions for a sale
 */
async function getCommissionsForSale(sale_id) {
  return db(TABLE)
    .select(
      'commission_records.*',
      'affiliates.referral_code',
      'users.name as affiliate_name',
      'users.email as affiliate_email'
    )
    .leftJoin('affiliates', 'commission_records.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .where('commission_records.sale_id', sale_id)
    .orderBy('commission_records.level', 'asc');
}

/**
 * Get commissions for an affiliate
 */
async function getCommissionsForAffiliate(affiliate_id, options = {}) {
  const { page = 1, pageSize = 20, status = null } = options;
  
  let query = db(TABLE)
    .select(
      'commission_records.*',
      'affiliate_sales.sale_reference',
      'affiliate_sales.sale_amount',
      'affiliate_sales.verification_status'
    )
    .leftJoin('affiliate_sales', 'commission_records.sale_id', 'affiliate_sales.id')
    .where('commission_records.affiliate_id', affiliate_id);
  
  if (status) {
    query = query.where('commission_records.status', status);
  }
  
  const offset = (page - 1) * pageSize;
  const data = await query.clone()
    .orderBy('commission_records.created_at', 'desc')
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
 * Mark commissions as paid for a sale
 */
async function markCommissionsPaidForSale(sale_id) {
  const commissions = await db(TABLE)
    .where({ sale_id, status: 'PENDING' })
    .update({
      status: 'PAID',
      paid_at: new Date()
    });
  
  // Update affiliate balances
  const commissionRecords = await db(TABLE)
    .select('affiliate_id', 'commission_amount')
    .where({ sale_id, status: 'PAID' });
  
  for (const record of commissionRecords) {
    await db('affiliates')
      .where({ id: record.affiliate_id })
      .increment('total_earnings', record.commission_amount)
      .increment('available_balance', record.commission_amount)
      .decrement('pending_balance', record.commission_amount);
  }
  
  return commissions;
}

/**
 * Update pending balances when commissions are created
 */
async function updatePendingBalances(sale_id) {
  const commissions = await db(TABLE)
    .select('affiliate_id', 'commission_amount')
    .where({ sale_id, status: 'PENDING' });
  
  for (const commission of commissions) {
    await db('affiliates')
      .where({ id: commission.affiliate_id })
      .increment('pending_balance', commission.commission_amount);
  }
}

/**
 * Cancel commissions for a sale (when sale is rejected)
 */
async function cancelCommissionsForSale(sale_id) {
  // Get pending commissions
  const commissions = await db(TABLE)
    .select('affiliate_id', 'commission_amount')
    .where({ sale_id, status: 'PENDING' });
  
  // Update affiliate pending balances
  for (const commission of commissions) {
    await db('affiliates')
      .where({ id: commission.affiliate_id })
      .decrement('pending_balance', commission.commission_amount);
  }
  
  // Mark commissions as cancelled
  await db(TABLE)
    .where({ sale_id, status: 'PENDING' })
    .update({ status: 'CANCELLED' });
}

/**
 * Get commission statistics for an affiliate
 */
async function getAffiliateCommissionStats(affiliate_id) {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_commissions'),
      db.raw('SUM(commission_amount) as total_amount'),
      db.raw('COUNT(CASE WHEN status = "PAID" THEN 1 END) as paid_commissions'),
      db.raw('SUM(CASE WHEN status = "PAID" THEN commission_amount ELSE 0 END) as paid_amount'),
      db.raw('COUNT(CASE WHEN status = "PENDING" THEN 1 END) as pending_commissions'),
      db.raw('SUM(CASE WHEN status = "PENDING" THEN commission_amount ELSE 0 END) as pending_amount')
    )
    .where({ affiliate_id })
    .first();
  
  // Get breakdown by level
  const levelStats = await db(TABLE)
    .select(
      'level',
      db.raw('COUNT(*) as count'),
      db.raw('SUM(commission_amount) as amount'),
      db.raw('AVG(commission_rate) as avg_rate')
    )
    .where({ affiliate_id })
    .groupBy('level')
    .orderBy('level', 'asc');
  
  return {
    total_commissions: Number(stats.total_commissions || 0),
    total_amount: Number(stats.total_amount || 0),
    paid_commissions: Number(stats.paid_commissions || 0),
    paid_amount: Number(stats.paid_amount || 0),
    pending_commissions: Number(stats.pending_commissions || 0),
    pending_amount: Number(stats.pending_amount || 0),
    by_level: levelStats.map(stat => ({
      level: stat.level,
      count: Number(stat.count),
      amount: Number(stat.amount),
      avg_rate: Number(stat.avg_rate || 0)
    }))
  };
}

/**
 * Get system-wide commission statistics
 */
async function getSystemCommissionStats() {
  const stats = await db(TABLE)
    .select(
      db.raw('COUNT(*) as total_commissions'),
      db.raw('SUM(commission_amount) as total_amount'),
      db.raw('COUNT(CASE WHEN status = "PAID" THEN 1 END) as paid_commissions'),
      db.raw('SUM(CASE WHEN status = "PAID" THEN commission_amount ELSE 0 END) as paid_amount'),
      db.raw('COUNT(CASE WHEN status = "PENDING" THEN 1 END) as pending_commissions'),
      db.raw('SUM(CASE WHEN status = "PENDING" THEN commission_amount ELSE 0 END) as pending_amount')
    )
    .first();
  
  return {
    total_commissions: Number(stats.total_commissions || 0),
    total_amount: Number(stats.total_amount || 0),
    paid_commissions: Number(stats.paid_commissions || 0),
    paid_amount: Number(stats.paid_amount || 0),
    pending_commissions: Number(stats.pending_commissions || 0),
    pending_amount: Number(stats.pending_amount || 0)
  };
}

/**
 * List all commissions with filters
 */
async function list(options = {}) {
  const { 
    page = 1, 
    pageSize = 20, 
    affiliate_id = null,
    status = null,
    level = null,
    sale_id = null
  } = options;
  
  let query = db(TABLE)
    .select(
      'commission_records.*',
      'affiliates.referral_code',
      'users.name as affiliate_name',
      'affiliate_sales.sale_reference',
      'affiliate_sales.sale_amount'
    )
    .leftJoin('affiliates', 'commission_records.affiliate_id', 'affiliates.id')
    .leftJoin('users', 'affiliates.user_id', 'users.id')
    .leftJoin('affiliate_sales', 'commission_records.sale_id', 'affiliate_sales.id');
  
  if (affiliate_id) {
    query = query.where('commission_records.affiliate_id', affiliate_id);
  }
  
  if (status) {
    query = query.where('commission_records.status', status);
  }
  
  if (typeof level === 'number') {
    query = query.where('commission_records.level', level);
  }
  
  if (sale_id) {
    query = query.where('commission_records.sale_id', sale_id);
  }
  
  const offset = (page - 1) * pageSize;
  const data = await query.clone()
    .orderBy('commission_records.created_at', 'desc')
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

module.exports = {
  TABLE,
  createCommissionsForSale,
  getCommissionsForSale,
  getCommissionsForAffiliate,
  markCommissionsPaidForSale,
  updatePendingBalances,
  cancelCommissionsForSale,
  getAffiliateCommissionStats,
  getSystemCommissionStats,
  list
};