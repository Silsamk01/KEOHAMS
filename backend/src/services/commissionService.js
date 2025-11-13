const Affiliate = require('../models/affiliate');
const AffiliateSale = require('../models/affiliateSale');
const CommissionRecord = require('../models/commissionRecord');
const db = require('../config/db');

/**
 * Commission Service
 * Handles all commission calculations and distributions
 */
class CommissionService {
  
  /**
   * Process a new sale and calculate commissions
   * This is the main entry point for commission processing
   */
  static async processSale(saleData) {
    const { affiliate_id, sale_amount, sale_reference } = saleData;
    
    // Validate inputs
    if (!affiliate_id || !sale_amount || !sale_reference) {
      throw new Error('Missing required sale data');
    }
    
    // Check for duplicate sale reference to prevent double payouts
    const existingSale = await AffiliateSale.findByReference(sale_reference);
    if (existingSale) {
      throw new Error(`Sale with reference ${sale_reference} already exists`);
    }
    
    // Verify affiliate exists and is active
    const affiliate = await Affiliate.findById(affiliate_id);
    if (!affiliate) {
      throw new Error('Affiliate not found');
    }
    
    if (!affiliate.is_active) {
      throw new Error('Affiliate is not active');
    }
    
    // Create the sale record
    const sale = await AffiliateSale.create(saleData);
    
    return sale;
  }
  
  /**
   * Calculate and create commission records for a verified sale
   * Called when admin verifies a sale
   */
  static async calculateCommissions(sale_id) {
    // Get the sale details
    const sale = await AffiliateSale.findById(sale_id);
    if (!sale) {
      throw new Error('Sale not found');
    }
    
    if (sale.verification_status !== 'VERIFIED') {
      throw new Error('Sale must be verified before calculating commissions');
    }
    
    if (sale.commissions_paid) {
      throw new Error('Commissions already calculated for this sale');
    }
    
    // DUPLICATE PREVENTION: Check if commissions already exist for this sale
    const existingCommissions = await CommissionRecord.getCommissionsForSale(sale_id);
    if (existingCommissions && existingCommissions.length > 0) {
      throw new Error('Commission records already exist for this sale');
    }
    
    // Use database transaction to ensure atomicity
    return await db.transaction(async (trx) => {
      // Double-check within transaction to prevent race conditions
      const existingInTrx = await trx('commission_records').where({ sale_id }).first();
      if (existingInTrx) {
        throw new Error('Commission records already exist for this sale (transaction check)');
      }
      
      // Create commission records
      const commissions = await CommissionRecord.createCommissionsForSale(
        sale_id,
        sale.affiliate_id,
        sale.sale_amount
      );
      
      // Update pending balances for affiliates
      await CommissionRecord.updatePendingBalances(sale_id);
      
      return commissions;
    });
  }
  
  /**
   * Release commissions (mark as paid and update balances)
   * Called when admin releases payments
   */
  static async releaseCommissions(sale_id) {
    const sale = await AffiliateSale.findById(sale_id);
    if (!sale) {
      throw new Error('Sale not found');
    }
    
    if (sale.verification_status !== 'VERIFIED') {
      throw new Error('Sale must be verified');
    }
    
    if (sale.commissions_paid) {
      throw new Error('Commissions already released for this sale');
    }
    
    // DUPLICATE PREVENTION: Check if any commissions are already paid
    const existingPaidCommissions = await db('commission_records')
      .where({ sale_id, status: 'PAID' })
      .first();
    
    if (existingPaidCommissions) {
      throw new Error('Some commissions for this sale are already paid');
    }
    
    // Use database transaction to ensure atomicity
    return await db.transaction(async (trx) => {
      // Double-check within transaction
      const paidInTrx = await trx('commission_records')
        .where({ sale_id, status: 'PAID' })
        .first();
      
      if (paidInTrx) {
        throw new Error('Commissions already paid for this sale (transaction check)');
      }
      
      // Mark commissions as paid and update balances
      await CommissionRecord.markCommissionsPaidForSale(sale_id);
      
      // Mark sale as commissions paid
      await AffiliateSale.markCommissionsPaid(sale_id);
      
      return true;
    });
  }
  
  /**
   * Cancel commissions for a rejected sale
   */
  static async cancelCommissions(sale_id) {
    const sale = await AffiliateSale.findById(sale_id);
    if (!sale) {
      throw new Error('Sale not found');
    }
    
    if (sale.commissions_paid) {
      throw new Error('Cannot cancel commissions that have already been paid');
    }
    
    // Cancel commissions and update pending balances
    await CommissionRecord.cancelCommissionsForSale(sale_id);
    
    return true;
  }
  
  /**
   * Get commission preview for a sale amount and affiliate
   * Useful for showing potential earnings before sale is made
   */
  static async getCommissionPreview(affiliate_id, sale_amount) {
    // Get commission settings
    const settings = await db('commission_settings')
      .where({ is_active: true })
      .orderBy('level', 'asc');
    
    if (!settings.length) {
      return { error: 'No commission settings configured' };
    }
    
    // Get affiliate upline chain
    const uplineChain = await Affiliate.getUplineChain(affiliate_id);
    
    // Add the direct seller at level 0
    const directSeller = await Affiliate.findById(affiliate_id);
    if (!directSeller) {
      return { error: 'Affiliate not found' };
    }
    
    const hierarchy = [directSeller, ...uplineChain];
    
    const preview = [];
    let totalCommissionRate = 0;
    let totalCommissionAmount = 0;
    const maxTotalRate = settings[0]?.max_total_rate || 25.00;
    
    // Calculate preview for each level
    for (let level = 0; level < hierarchy.length && level < settings.length; level++) {
      const affiliate = hierarchy[level];
      const setting = settings[level];
      
      // Check if we've exceeded the maximum total commission rate
      if (totalCommissionRate + setting.rate > maxTotalRate) {
        const remainingRate = maxTotalRate - totalCommissionRate;
        if (remainingRate > 0) {
          const commissionAmount = (sale_amount * remainingRate) / 100;
          preview.push({
            affiliate_id: affiliate.id,
            affiliate_name: affiliate.name,
            referral_code: affiliate.referral_code,
            level,
            commission_rate: remainingRate,
            commission_amount: commissionAmount,
            is_capped: true
          });
          totalCommissionRate += remainingRate;
          totalCommissionAmount += commissionAmount;
        }
        break;
      }
      
      const commissionAmount = (sale_amount * setting.rate) / 100;
      preview.push({
        affiliate_id: affiliate.id,
        affiliate_name: affiliate.name,
        referral_code: affiliate.referral_code,
        level,
        commission_rate: setting.rate,
        commission_amount: commissionAmount,
        is_capped: false
      });
      
      totalCommissionRate += setting.rate;
      totalCommissionAmount += commissionAmount;
    }
    
    return {
      sale_amount,
      total_commission_rate: totalCommissionRate,
      total_commission_amount: totalCommissionAmount,
      commissions: preview,
      hierarchy_depth: hierarchy.length,
      applied_levels: preview.length
    };
  }
  
  /**
   * Get detailed affiliate earnings breakdown
   */
  static async getAffiliateEarnings(affiliate_id) {
    const affiliate = await Affiliate.findById(affiliate_id);
    if (!affiliate) {
      throw new Error('Affiliate not found');
    }
    
    // Get sales statistics
    const salesStats = await AffiliateSale.getAffiliateStats(affiliate_id);
    
    // Get commission statistics
    const commissionStats = await CommissionRecord.getAffiliateCommissionStats(affiliate_id);
    
    // Get recent sales
    const recentSales = await AffiliateSale.list({
      affiliate_id,
      page: 1,
      pageSize: 10
    });
    
    // Get recent commissions
    const recentCommissions = await CommissionRecord.getCommissionsForAffiliate(affiliate_id, {
      page: 1,
      pageSize: 10
    });
    
    return {
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        referral_code: affiliate.referral_code,
        total_earnings: affiliate.total_earnings,
        available_balance: affiliate.available_balance,
        pending_balance: affiliate.pending_balance,
        direct_referrals: affiliate.direct_referrals,
        total_downline: affiliate.total_downline
      },
      sales: salesStats,
      commissions: commissionStats,
      recent_sales: recentSales.data,
      recent_commissions: recentCommissions.data
    };
  }
  
  /**
   * Get system-wide affiliate statistics
   */
  static async getSystemStats() {
    // Get affiliate counts
    const [affiliateStats] = await db('affiliates')
      .select(
        db.raw('COUNT(*) as total_affiliates'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_affiliates'),
        db.raw('SUM(total_earnings) as total_earnings'),
        db.raw('SUM(available_balance) as available_balance'),
        db.raw('SUM(pending_balance) as pending_balance')
      );
    
    // Get sales statistics
    const salesStats = await AffiliateSale.getSystemStats();
    
    // Get commission statistics
    const commissionStats = await CommissionRecord.getSystemCommissionStats();
    
    return {
      affiliates: {
        total: Number(affiliateStats.total_affiliates || 0),
        active: Number(affiliateStats.active_affiliates || 0),
        total_earnings: Number(affiliateStats.total_earnings || 0),
        available_balance: Number(affiliateStats.available_balance || 0),
        pending_balance: Number(affiliateStats.pending_balance || 0)
      },
      sales: salesStats,
      commissions: commissionStats
    };
  }
  
  /**
   * Validate commission settings
   */
  static async validateCommissionSettings() {
    const settings = await db('commission_settings')
      .where({ is_active: true })
      .orderBy('level', 'asc');
    
    if (!settings.length) {
      return { valid: false, error: 'No commission settings found' };
    }
    
    let totalRate = 0;
    const maxTotalRate = settings[0]?.max_total_rate || 25.00;
    
    for (const setting of settings) {
      totalRate += setting.rate;
      if (totalRate > maxTotalRate) {
        return { 
          valid: false, 
          error: `Total commission rate (${totalRate}%) exceeds maximum (${maxTotalRate}%)` 
        };
      }
    }
    
    return { valid: true, totalRate, maxTotalRate, levels: settings.length };
  }
  
  /**
   * Process bulk commission release
   * Releases commissions for multiple verified sales
   */
  static async bulkReleaseCommissions(sale_ids) {
    const results = [];
    
    for (const sale_id of sale_ids) {
      try {
        await this.releaseCommissions(sale_id);
        results.push({ sale_id, success: true });
      } catch (error) {
        results.push({ sale_id, success: false, error: error.message });
      }
    }
    
    return results;
  }
}

module.exports = CommissionService;