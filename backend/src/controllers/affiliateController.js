const Affiliate = require('../models/affiliate');
const AffiliateSale = require('../models/affiliateSale');
const CommissionRecord = require('../models/commissionRecord');
const CommissionService = require('../services/commissionService');
const Users = require('../models/user');
const db = require('../config/db');
const { sendMail } = require('../utils/email');

/**
 * Register a new affiliate
 */
exports.register = async (req, res) => {
  try {
    const { user_id, parent_referral_code } = req.body;
    
    // Validate user exists
    const user = await Users.findById(user_id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is already an affiliate
    const existingAffiliate = await Affiliate.findByUserId(user_id);
    if (existingAffiliate) {
      return res.status(400).json({ message: 'User is already an affiliate' });
    }
    
    let parent_affiliate_id = null;
    
    // If parent referral code provided, validate it
    if (parent_referral_code) {
      const parentAffiliate = await Affiliate.findByReferralCode(parent_referral_code);
      if (!parentAffiliate) {
        return res.status(400).json({ message: 'Invalid parent referral code' });
      }
      if (!parentAffiliate.is_active) {
        return res.status(400).json({ message: 'Parent affiliate is not active' });
      }
      parent_affiliate_id = parentAffiliate.id;
    }
    
    // Create affiliate
    const affiliate = await Affiliate.create({
      user_id,
      parent_affiliate_id
    });
    
    // Send welcome email
    try {
      await sendMail({
        to: user.email,
        subject: 'Welcome to KEOHAMS Affiliate Program',
        html: `
          <h2>Welcome to KEOHAMS Affiliate Program!</h2>
          <p>Hi ${user.name},</p>
          <p>Congratulations! You have successfully joined the KEOHAMS affiliate program.</p>
          <p><strong>Your unique referral code:</strong> ${affiliate.referral_code}</p>
          <p>Share this code with others to start earning commissions:</p>
          <ul>
            <li>Direct sales: 10% commission</li>
            <li>Network sales: 2.5% per level</li>
          </ul>
          <p>Login to your dashboard to track your earnings and manage your affiliate account.</p>
          <p>Best regards,<br>KEOHAMS Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    res.status(201).json({
      message: 'Affiliate registration successful',
      affiliate: {
        id: affiliate.id,
        referral_code: affiliate.referral_code,
        total_earnings: affiliate.total_earnings,
        available_balance: affiliate.available_balance,
        pending_balance: affiliate.pending_balance
      }
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    res.status(500).json({ message: 'Failed to register affiliate', error: error.message });
  }
};

/**
 * Get affiliate dashboard data
 */
exports.getDashboard = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const earnings = await CommissionService.getAffiliateEarnings(affiliate.id);
    
    res.json(earnings);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Failed to get dashboard data', error: error.message });
  }
};

/**
 * Get affiliate's downline/upline tree
 */
exports.getNetworkTree = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { type = 'downline', levels = 5 } = req.query;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    let tree = [];
    
    if (type === 'downline') {
      tree = await Affiliate.getDownline(affiliate.id, 0, parseInt(levels));
    } else if (type === 'upline') {
      tree = await Affiliate.getUplineChain(affiliate.id);
    }
    
    res.json({ type, affiliate, tree });
  } catch (error) {
    console.error('Network tree error:', error);
    res.status(500).json({ message: 'Failed to get network tree', error: error.message });
  }
};

/**
 * Record a new sale
 */
exports.recordSale = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { customer_email, sale_amount, payment_method, payment_details, sale_reference } = req.body;
    
    // Find affiliate
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    if (!affiliate.is_active) {
      return res.status(400).json({ message: 'Affiliate account is not active' });
    }
    
    // Validate required fields
    if (!sale_amount || !payment_method || !sale_reference) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    if (sale_amount <= 0) {
      return res.status(400).json({ message: 'Sale amount must be greater than 0' });
    }
    
    // Find customer if email provided
    let customer_id = null;
    if (customer_email) {
      const customer = await Users.findByEmail(customer_email);
      customer_id = customer?.id || null;
    }
    
    // Process the sale
    const sale = await CommissionService.processSale({
      affiliate_id: affiliate.id,
      customer_id,
      sale_reference,
      sale_amount: parseFloat(sale_amount),
      payment_method,
      payment_details
    });
    
    // Get commission preview
    const preview = await CommissionService.getCommissionPreview(affiliate.id, sale.sale_amount);
    
    res.status(201).json({
      message: 'Sale recorded successfully',
      sale,
      commission_preview: preview
    });
  } catch (error) {
    console.error('Record sale error:', error);
    res.status(500).json({ message: 'Failed to record sale', error: error.message });
  }
};

/**
 * Get affiliate's sales
 */
exports.getSales = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, pageSize = 20, status } = req.query;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const sales = await AffiliateSale.list({
      affiliate_id: affiliate.id,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      verification_status: status
    });
    
    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ message: 'Failed to get sales', error: error.message });
  }
};

/**
 * Get affiliate's commissions
 */
exports.getCommissions = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, pageSize = 20, status } = req.query;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const commissions = await CommissionRecord.getCommissionsForAffiliate(affiliate.id, {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      status
    });
    
    res.json(commissions);
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ message: 'Failed to get commissions', error: error.message });
  }
};

/**
 * Get commission preview for potential sale
 */
exports.getCommissionPreview = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { sale_amount } = req.query;
    
    if (!sale_amount || isNaN(sale_amount) || parseFloat(sale_amount) <= 0) {
      return res.status(400).json({ message: 'Valid sale amount required' });
    }
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const preview = await CommissionService.getCommissionPreview(affiliate.id, parseFloat(sale_amount));
    
    res.json(preview);
  } catch (error) {
    console.error('Commission preview error:', error);
    res.status(500).json({ message: 'Failed to get commission preview', error: error.message });
  }
};

/**
 * Get affiliate by referral code (public endpoint for referral links)
 */
exports.getByReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const affiliate = await Affiliate.findByReferralCode(code);
    if (!affiliate) {
      return res.status(404).json({ message: 'Referral code not found' });
    }
    
    if (!affiliate.is_active) {
      return res.status(400).json({ message: 'Affiliate is not active' });
    }
    
    res.json({
      referral_code: affiliate.referral_code,
      affiliate_name: affiliate.name,
      affiliate_email: affiliate.email,
      is_active: affiliate.is_active
    });
  } catch (error) {
    console.error('Get by referral code error:', error);
    res.status(500).json({ message: 'Failed to get affiliate', error: error.message });
  }
};

/**
 * Update affiliate profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { user_id } = req.params;
    const updates = req.body;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    // Only allow updating specific fields
    const allowedFields = ['is_active'];
    const filteredUpdates = {};
    
    for (const field of allowedFields) {
      if (updates.hasOwnProperty(field)) {
        filteredUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    await db('affiliates').where({ id: affiliate.id }).update(filteredUpdates);
    
    const updatedAffiliate = await Affiliate.findById(affiliate.id);
    
    res.json({
      message: 'Profile updated successfully',
      affiliate: updatedAffiliate
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

/**
 * Get affiliate statistics
 */
exports.getStats = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const affiliate = await Affiliate.findByUserId(user_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const stats = await Affiliate.getStats(affiliate.id);
    
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get statistics', error: error.message });
  }
};