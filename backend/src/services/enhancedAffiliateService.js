const db = require('../config/db');
const crypto = require('crypto');

class EnhancedAffiliateService {
  /**
   * Track affiliate click
   */
  static async trackClick(referralCode, ipAddress, userAgent, referrerUrl, landingPage, sessionId) {
    // Get affiliate by referral code
    const affiliate = await db('affiliates')
      .where('referral_code', referralCode)
      .where('status', 'ACTIVE')
      .first();

    if (!affiliate) {
      throw new Error('Invalid referral code');
    }

    // Insert click record
    const [clickId] = await db('affiliate_clicks').insert({
      affiliate_id: affiliate.id,
      referral_code: referralCode,
      ip_address: ipAddress,
      user_agent: userAgent,
      referrer_url: referrerUrl,
      landing_page: landingPage,
      session_id: sessionId
    });

    // Update affiliate total clicks
    await db('affiliates')
      .where('id', affiliate.id)
      .increment('total_clicks', 1);

    // Update conversion rate
    await this.updateConversionRate(affiliate.id);

    return { click_id: clickId, affiliate_id: affiliate.id };
  }

  /**
   * Track affiliate conversion (order)
   */
  static async trackConversion(orderId, userId, clickId = null) {
    const order = await db('orders').where('id', orderId).first();
    if (!order) {
      throw new Error('Order not found');
    }

    // Get referral from user or click
    let affiliateId = null;
    let referralCode = null;

    if (clickId) {
      const click = await db('affiliate_clicks').where('id', clickId).first();
      if (click) {
        affiliateId = click.affiliate_id;
        referralCode = click.referral_code;
        
        // Update click with referred user
        await db('affiliate_clicks')
          .where('id', clickId)
          .update({ referred_user_id: userId });
      }
    }

    if (!affiliateId) {
      // Check if user was referred
      const user = await db('users').where('id', userId).first();
      if (user && user.referred_by_code) {
        const affiliate = await db('affiliates')
          .where('referral_code', user.referred_by_code)
          .first();
        if (affiliate) {
          affiliateId = affiliate.id;
          referralCode = user.referred_by_code;
        }
      }
    }

    if (!affiliateId) {
      return null; // No affiliate to credit
    }

    // Get commission rate (custom or default)
    const commissionRate = await this.getCommissionRate(affiliateId, order);
    const commissionAmount = (order.total_amount * commissionRate) / 100;

    // Create conversion record
    const [conversionId] = await db('affiliate_conversions').insert({
      affiliate_id: affiliateId,
      click_id: clickId,
      order_id: orderId,
      user_id: userId,
      order_amount: order.total_amount,
      commission_amount: commissionAmount,
      commission_rate: commissionRate,
      status: 'PENDING' // Requires approval
    });

    // Update affiliate total conversions
    await db('affiliates')
      .where('id', affiliateId)
      .increment('total_conversions', 1);

    // Update conversion rate
    await this.updateConversionRate(affiliateId);

    return await db('affiliate_conversions').where('id', conversionId).first();
  }

  /**
   * Get commission rate for affiliate/order
   */
  static async getCommissionRate(affiliateId, order) {
    // Get order items
    const orderItems = await db('order_items')
      .where('order_id', order.id);

    let totalRate = 0;
    let totalAmount = 0;

    for (const item of orderItems) {
      // Check for product-specific rate
      let rate = await db('custom_commission_rates')
        .where('affiliate_id', affiliateId)
        .where('rate_type', 'PRODUCT')
        .where('product_id', item.product_id)
        .where('is_active', true)
        .where(function() {
          this.whereNull('valid_from').orWhere('valid_from', '<=', db.fn.now());
        })
        .where(function() {
          this.whereNull('valid_until').orWhere('valid_until', '>=', db.fn.now());
        })
        .first();

      if (!rate) {
        // Check for category-specific rate
        const product = await db('products').where('id', item.product_id).first();
        if (product && product.category_id) {
          rate = await db('custom_commission_rates')
            .where('affiliate_id', affiliateId)
            .where('rate_type', 'CATEGORY')
            .where('category_id', product.category_id)
            .where('is_active', true)
            .where(function() {
              this.whereNull('valid_from').orWhere('valid_from', '<=', db.fn.now());
            })
            .where(function() {
              this.whereNull('valid_until').orWhere('valid_until', '>=', db.fn.now());
            })
            .first();
        }
      }

      if (!rate) {
        // Check for global custom rate
        rate = await db('custom_commission_rates')
          .where('affiliate_id', affiliateId)
          .where('rate_type', 'GLOBAL')
          .where('is_active', true)
          .where(function() {
            this.whereNull('valid_from').orWhere('valid_from', '<=', db.fn.now());
          })
          .where(function() {
            this.whereNull('valid_until').orWhere('valid_until', '>=', db.fn.now());
          })
          .first();
      }

      const itemRate = rate ? rate.commission_rate : 10; // Default 10%
      totalRate += itemRate * item.subtotal;
      totalAmount += item.subtotal;
    }

    return totalAmount > 0 ? totalRate / totalAmount : 10;
  }

  /**
   * Update affiliate conversion rate
   */
  static async updateConversionRate(affiliateId) {
    const affiliate = await db('affiliates').where('id', affiliateId).first();
    
    if (affiliate.total_clicks > 0) {
      const rate = (affiliate.total_conversions / affiliate.total_clicks) * 100;
      await db('affiliates')
        .where('id', affiliateId)
        .update({ conversion_rate: rate.toFixed(2) });
    }
  }

  /**
   * Approve conversion
   */
  static async approveConversion(conversionId, approvedBy) {
    const conversion = await db('affiliate_conversions')
      .where('id', conversionId)
      .first();

    if (!conversion) {
      throw new Error('Conversion not found');
    }

    if (conversion.status !== 'PENDING') {
      throw new Error('Conversion already processed');
    }

    await db('affiliate_conversions')
      .where('id', conversionId)
      .update({
        status: 'APPROVED',
        approved_at: db.fn.now()
      });

    // Update affiliate earnings
    await db('affiliates')
      .where('id', conversion.affiliate_id)
      .increment('total_earnings', conversion.commission_amount);

    return await db('affiliate_conversions').where('id', conversionId).first();
  }

  /**
   * Reject conversion
   */
  static async rejectConversion(conversionId, reason) {
    await db('affiliate_conversions')
      .where('id', conversionId)
      .update({
        status: 'REJECTED',
        rejection_reason: reason
      });

    return await db('affiliate_conversions').where('id', conversionId).first();
  }

  /**
   * Request withdrawal
   */
  static async requestWithdrawal(affiliateId, amount, method, paymentDetails) {
    const affiliate = await db('affiliates').where('id', affiliateId).first();

    if (!affiliate) {
      throw new Error('Affiliate not found');
    }

    const availableBalance = affiliate.total_earnings - (affiliate.total_withdrawn || 0);

    if (amount > availableBalance) {
      throw new Error('Insufficient balance');
    }

    if (amount < 50) {
      throw new Error('Minimum withdrawal amount is ₦50');
    }

    const [withdrawalId] = await db('affiliate_withdrawals').insert({
      affiliate_id: affiliateId,
      amount,
      method,
      payment_details: JSON.stringify(paymentDetails),
      status: 'PENDING'
    });

    return await db('affiliate_withdrawals').where('id', withdrawalId).first();
  }

  /**
   * Process withdrawal
   */
  static async processWithdrawal(withdrawalId, processedBy, status, transactionReference = null, rejectionReason = null) {
    const withdrawal = await db('affiliate_withdrawals')
      .where('id', withdrawalId)
      .first();

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'PENDING') {
      throw new Error('Withdrawal already processed');
    }

    const updates = {
      status,
      processed_by: processedBy,
      processed_at: db.fn.now()
    };

    if (status === 'COMPLETED') {
      updates.transaction_reference = transactionReference;
      
      // Update affiliate total withdrawn
      await db('affiliates')
        .where('id', withdrawal.affiliate_id)
        .increment('total_withdrawn', withdrawal.amount);
    } else if (status === 'REJECTED') {
      updates.rejection_reason = rejectionReason;
    }

    await db('affiliate_withdrawals')
      .where('id', withdrawalId)
      .update(updates);

    return await db('affiliate_withdrawals').where('id', withdrawalId).first();
  }

  /**
   * Get affiliate performance dashboard
   */
  static async getPerformanceDashboard(affiliateId, startDate = null, endDate = null) {
    let clickQuery = db('affiliate_clicks').where('affiliate_id', affiliateId);
    let conversionQuery = db('affiliate_conversions').where('affiliate_id', affiliateId);

    if (startDate) {
      clickQuery = clickQuery.where('clicked_at', '>=', startDate);
      conversionQuery = conversionQuery.where('created_at', '>=', startDate);
    }

    if (endDate) {
      clickQuery = clickQuery.where('clicked_at', '<=', endDate);
      conversionQuery = conversionQuery.where('created_at', '<=', endDate);
    }

    const clicks = await clickQuery.count('* as count').first();
    const conversions = await conversionQuery
      .select(
        db.raw('COUNT(*) as count'),
        db.raw('SUM(commission_amount) as total_commission'),
        db.raw('AVG(commission_rate) as avg_commission_rate')
      )
      .first();

    const pendingEarnings = await db('affiliate_conversions')
      .where('affiliate_id', affiliateId)
      .where('status', 'PENDING')
      .sum('commission_amount as total')
      .first();

    const approvedEarnings = await db('affiliate_conversions')
      .where('affiliate_id', affiliateId)
      .where('status', 'APPROVED')
      .sum('commission_amount as total')
      .first();

    const affiliate = await db('affiliates').where('id', affiliateId).first();

    return {
      total_clicks: clicks.count || 0,
      total_conversions: conversions.count || 0,
      conversion_rate: clicks.count > 0 ? ((conversions.count / clicks.count) * 100).toFixed(2) : 0,
      total_earnings: affiliate.total_earnings || 0,
      pending_earnings: pendingEarnings.total || 0,
      approved_earnings: approvedEarnings.total || 0,
      total_withdrawn: affiliate.total_withdrawn || 0,
      available_balance: (affiliate.total_earnings || 0) - (affiliate.total_withdrawn || 0),
      avg_commission_rate: conversions.avg_commission_rate || 0
    };
  }

  /**
   * Get top performing affiliates (admin)
   */
  static async getTopPerformers(limit = 10) {
    return await db('affiliates')
      .where('status', 'ACTIVE')
      .orderBy('total_earnings', 'desc')
      .limit(limit)
      .select(
        'id',
        'referral_code',
        'total_clicks',
        'total_conversions',
        'conversion_rate',
        'total_earnings',
        'total_withdrawn'
      );
  }

  /**
   * Set custom commission rate
   */
  static async setCustomRate(affiliateId, rateType, rate, createdBy, productId = null, categoryId = null, validFrom = null, validUntil = null) {
    const [rateId] = await db('custom_commission_rates').insert({
      affiliate_id: affiliateId,
      rate_type: rateType,
      product_id: productId,
      category_id: categoryId,
      commission_rate: rate,
      valid_from: validFrom,
      valid_until: validUntil,
      created_by: createdBy,
      is_active: true
    });

    return await db('custom_commission_rates').where('id', rateId).first();
  }
}

module.exports = EnhancedAffiliateService;
