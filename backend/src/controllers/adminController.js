const db = require('../config/db');
const Users = require('../models/user');
const AdminAudit = require('../models/adminAuditEvent');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { sendMail } = require('../utils/email');

exports.stats = async (req, res) => {
  // Hard delete semantics: only existing rows are active
  const [u] = await db('users').count({ c: '*' });
  const [p] = await db('products').count({ c: '*' }).catch(() => [{ c: 0 }]);
  const [c] = await db('categories').count({ c: '*' }).catch(() => [{ c: 0 }]);
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.json({ users: Number(u.c||0), products: Number(p.c||0), categories: Number(c.c||0) });
};

exports.listUsers = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || '').trim();
  const base = db(Users.TABLE)
    .select('id','name','email','role','email_verified','is_active','created_at');
  if (q) base.andWhere((b)=> b.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`));
  base.orderBy('id','desc');
  const offset = (page - 1) * pageSize;
  const data = await base.clone().offset(offset).limit(pageSize);
  const countQuery = db(Users.TABLE).modify(qb => { if (q) qb.andWhere((b)=> b.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`)); });
  const [{ count }] = await countQuery.count({ count: '*' });
  res.json({ data, total: Number(count || 0) });
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, email_verified, is_active } = req.body;
  const changes = {};
  if (role) {
    if (!['ADMIN','CUSTOMER'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    changes.role = role;
  }
  if (typeof email_verified === 'boolean') changes.email_verified = email_verified;
  if (typeof is_active === 'boolean') changes.is_active = is_active;
  if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes' });
  await db(Users.TABLE).where({ id }).update(changes);
  const user = await Users.findById(id);
  res.json({ user });
};

// Hard delete semantics: removing a user fully erases their row. We keep audit events.
// Safeguards:
//  - Prevent self deletion via panel
//  - Prevent deletion of the final remaining admin
//  - Remove dependent ephemeral credential rows before deleting user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.sub) return res.status(400).json({ message: 'Cannot delete your own user via admin panel' });
  const user = await Users.findById(id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  if (user.role === 'ADMIN') {
    const [{ count: adminCount }] = await db(Users.TABLE).where({ role: 'ADMIN' }).count({ count: '*' });
    if (Number(adminCount || 0) <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last admin' });
    }
  }
  // Delete dependent simple tables (tokens, twofa_recovery_codes) before user for FK integrity if any
  try { await db('tokens').where({ user_id: id }).del(); } catch(_){}
  try { await db('twofa_recovery_codes').where({ user_id: id, used: 0 }).del(); } catch(_){}
  await db(Users.TABLE).where({ id }).del();
  await AdminAudit.log({ admin_id: req.user.sub, target_user_id: id, action: 'USER_DELETE', metadata: { soft: false } }).catch(()=>{});
  res.json({ message: 'Deleted' });
};

// Profile endpoints
exports.getProfile = async (req, res) => {
  const user = await Users.findById(req.user.sub);
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, twofa_enabled: !!user.twofa_secret });
};

exports.updateProfile = async (req, res) => {
  const { name, phone, address } = req.body;
  await Users.update(req.user.sub, { name, phone, address });
  const user = await Users.findById(req.user.sub);
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, twofa_enabled: !!user.twofa_secret });
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ message: 'Missing fields' });
  const user = await Users.findById(req.user.sub);
  const ok = await bcrypt.compare(current_password, user.password_hash);
  if (!ok) return res.status(400).json({ message: 'Current password incorrect' });
  const password_hash = await bcrypt.hash(new_password, 10);
  await Users.update(user.id, { password_hash });
  res.json({ message: 'Password updated' });
};

exports.twofaSetup = async (req, res) => {
  const user = await Users.findById(req.user.sub);
  const secret = speakeasy.generateSecret({ name: process.env.TWOFA_ISSUER || 'KEOHAMS', length: 20 });
  const otpauth_url = secret.otpauth_url;
  const qr = await qrcode.toDataURL(otpauth_url);
  // Temporarily return base32; client must verify code then call enable
  res.json({ base32: secret.base32, otpauth_url, qr });
};

exports.twofaEnable = async (req, res) => {
  const { base32, token } = req.body;
  if (!base32 || !token) return res.status(400).json({ message: 'Missing fields' });
  const verified = speakeasy.totp.verify({ secret: base32, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(400).json({ message: 'Invalid code' });
  await Users.update(req.user.sub, { twofa_secret: base32 });
  res.json({ message: '2FA enabled' });
};

exports.twofaDisable = async (req, res) => {
  await Users.update(req.user.sub, { twofa_secret: null });
  res.json({ message: '2FA disabled' });
};

// Pending registrations
exports.listPendingRegs = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || '').trim();
  const base = db('pending_registrations').select('id','name','email','dob','expires_at','created_at');
  if (q) base.where((b)=> b.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`));
  base.orderBy('id','desc');
  const offset = (page - 1) * pageSize;
  const data = await base.clone().offset(offset).limit(pageSize);
  const [{ count }] = await db('pending_registrations').modify((qb)=>{ if (q) qb.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`); }).count({ count: '*' });
  res.json({ data, total: Number(count || 0) });
};

exports.resendPendingReg = async (req, res) => {
  const { id } = req.params;
  const row = await db('pending_registrations').where({ id }).first();
  if (!row) return res.status(404).json({ message: 'Not found' });
  const token = crypto.randomBytes(24).toString('hex');
  const expires_at = new Date(Date.now() + 1000*60*60*24);
  await db('pending_registrations').where({ id }).update({ token, expires_at });
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify?token=${token}&flow=pending`;
  await sendMail({ to: row.email, subject: 'Verify your email', html: `<p>Hello ${row.name},</p><p>Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>` });
  res.json({ message: 'Check your email for a link. If it doesn\'t appear within a few minutes, check your spam folder and if in Spam move to inbox.' });
};

exports.deletePendingReg = async (req, res) => {
  const { id } = req.params;
  await db('pending_registrations').where({ id }).del();
  res.json({ message: 'Deleted' });
};

exports.forceCreateFromPending = async (req, res) => {
  const { id } = req.params;
  const row = await db('pending_registrations').where({ id }).first();
  if (!row) return res.status(404).json({ message: 'Not found' });
  // If user exists with email, abort
  const existing = await Users.findByEmail(row.email);
  if (existing) return res.status(409).json({ message: 'Email already registered' });
  const [userId] = await Users.create({
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    phone: row.phone,
    address: row.address,
    dob: row.dob,
    referral_code: row.referral_code || null,
    role: 'CUSTOMER',
    email_verified: 1
  });
  
  // Auto-create affiliate sale if user was referred
  if (row.referral_code) {
    try {
      const referringAffiliate = await Affiliate.findByReferralCode(row.referral_code);
      if (referringAffiliate && referringAffiliate.is_active) {
        // Store link for future purchase tracking
        console.log(`User ${userId} was referred by affiliate ${referringAffiliate.id} (${row.referral_code})`);
      }
    } catch (err) {
      console.warn('Failed to link referral:', err.message);
    }
  }
  
  await db('pending_registrations').where({ id }).del();
  res.json({ message: 'User created', user_id: userId });
};

// Revoke all active tokens by bumping token_version
exports.revokeUserTokens = async (req, res) => {
  const { id } = req.params;
  const user = await Users.findById(id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  const nextVersion = (user.token_version || 1) + 1;
  await Users.update(user.id, { token_version: nextVersion });
  await AdminAudit.log({ admin_id: req.user.sub, target_user_id: user.id, action: 'TOKEN_REVOKE', metadata: { prev: user.token_version, next: nextVersion } }).catch(()=>{});
  
  // Emit forceLogout via Socket.IO if available
  try {
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${user.id}`).emit('forceLogout', {
        reason: 'Token revoked by administrator',
        message: 'Your session has been terminated. Please sign in again.'
      });
    }
  } catch (err) {
    // Non-fatal if sockets not available
  }

  res.json({ message: 'Revoked', token_version: nextVersion });
};

// ==================== AFFILIATE MANAGEMENT ====================
const Affiliate = require('../models/affiliate');
const AffiliateSale = require('../models/affiliateSale');
const CommissionRecord = require('../models/commissionRecord');
const AffiliateWithdrawal = require('../models/affiliateWithdrawal');
const CommissionService = require('../services/commissionService');

/**
 * Get affiliate system overview statistics
 */
exports.getAffiliateStats = async (req, res) => {
  try {
    const stats = await CommissionService.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('Admin affiliate stats error:', error);
    res.status(500).json({ message: 'Failed to get affiliate statistics', error: error.message });
  }
};

/**
 * List all affiliates with pagination and search
 */
exports.listAffiliates = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, search = '', status = 'all' } = req.query;
    
    const affiliates = await Affiliate.list({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      search,
      status
    });
    
    res.json(affiliates);
  } catch (error) {
    console.error('Admin list affiliates error:', error);
    res.status(500).json({ message: 'Failed to list affiliates', error: error.message });
  }
};

/**
 * Get pending sales awaiting verification
 */
exports.getPendingSales = async (req, res) => {
  try {
    const pendingSales = await AffiliateSale.getPendingVerification();
    
    // Add commission preview for each sale
    const salesWithPreviews = await Promise.all(
      pendingSales.map(async (sale) => {
        const preview = await CommissionService.getCommissionPreview(sale.affiliate_id, sale.sale_amount);
        return { ...sale, commission_preview: preview };
      })
    );
    
    res.json(salesWithPreviews);
  } catch (error) {
    console.error('Admin get pending sales error:', error);
    res.status(500).json({ message: 'Failed to get pending sales', error: error.message });
  }
};

/**
 * Get sale details by ID
 */
exports.getSaleDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await AffiliateSale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    // Get commission records if they exist
    const commissions = await CommissionRecord.getCommissionsForSale(id);
    
    res.json({
      ...sale,
      commissions: commissions || []
    });
  } catch (error) {
    console.error('Admin get sale details error:', error);
    res.status(500).json({ message: 'Failed to get sale details', error: error.message });
  }
};

/**
 * Verify a sale (approve or reject)
 */
exports.verifySale = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes = '' } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "approve" or "reject"' });
    }
    
    const sale = await AffiliateSale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    if (sale.verification_status !== 'PENDING') {
      return res.status(400).json({ message: 'Sale is not pending verification' });
    }
    
    const status = action === 'approve' ? 'VERIFIED' : 'REJECTED';
    
    // Update sale status
    const updatedSale = await AffiliateSale.updateVerificationStatus(
      id,
      status,
      req.user.sub,
      notes
    );
    
    // Log admin action
    await AdminAudit.log({
      admin_id: req.user.sub,
      target_user_id: sale.affiliate_id,
      action: `SALE_${status}`,
      metadata: {
        sale_id: id,
        sale_reference: sale.sale_reference,
        sale_amount: sale.sale_amount,
        notes
      }
    }).catch(() => {});
    
    let commissions = null;
    
    if (action === 'approve') {
      // Calculate and create commission records
      commissions = await CommissionService.calculateCommissions(id);
    } else {
      // Cancel any existing pending commissions
      await CommissionService.cancelCommissions(id);
    }
    
    res.json({
      message: `Sale ${action}d successfully`,
      sale: updatedSale,
      commissions: commissions
    });
  } catch (error) {
    console.error('Admin verify sale error:', error);
    res.status(500).json({ message: 'Failed to verify sale', error: error.message });
  }
};

/**
 * Get verified sales with unpaid commissions
 */
exports.getUnpaidCommissions = async (req, res) => {
  try {
    const unpaidSales = await AffiliateSale.getVerifiedUnpaidSales();
    
    // Get commission details for each sale
    const salesWithCommissions = await Promise.all(
      unpaidSales.map(async (sale) => {
        const commissions = await CommissionRecord.getCommissionsForSale(sale.id);
        return { ...sale, commissions };
      })
    );
    
    res.json(salesWithCommissions);
  } catch (error) {
    console.error('Admin get unpaid commissions error:', error);
    res.status(500).json({ message: 'Failed to get unpaid commissions', error: error.message });
  }
};

/**
 * Release commissions for verified sales
 */
exports.releaseCommissions = async (req, res) => {
  try {
    const { sale_ids } = req.body;
    
    if (!Array.isArray(sale_ids) || sale_ids.length === 0) {
      return res.status(400).json({ message: 'Sale IDs array required' });
    }
    
    const results = await CommissionService.bulkReleaseCommissions(sale_ids);
    
    // Log admin action for each successful release
    for (const result of results) {
      if (result.success) {
        await AdminAudit.log({
          admin_id: req.user.sub,
          action: 'COMMISSION_RELEASE',
          metadata: {
            sale_id: result.sale_id
          }
        }).catch(() => {});
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      message: `Commission release completed. ${successful} successful, ${failed} failed.`,
      results
    });
  } catch (error) {
    console.error('Admin release commissions error:', error);
    res.status(500).json({ message: 'Failed to release commissions', error: error.message });
  }
};

/**
 * Get affiliate details and statistics
 */
exports.getAffiliateDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const affiliate = await Affiliate.findById(id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    const stats = await Affiliate.getStats(id);
    const upline = await Affiliate.getUplineChain(id);
    const downline = await Affiliate.getDownline(id, 0, 3); // Get 3 levels of downline
    
    // Get recent sales and commissions
    const recentSales = await AffiliateSale.list({
      affiliate_id: id,
      page: 1,
      pageSize: 10
    });
    
    const recentCommissions = await CommissionRecord.getCommissionsForAffiliate(id, {
      page: 1,
      pageSize: 10
    });
    
    res.json({
      affiliate,
      stats,
      upline,
      downline,
      recent_sales: recentSales.data,
      recent_commissions: recentCommissions.data
    });
  } catch (error) {
    console.error('Admin get affiliate details error:', error);
    res.status(500).json({ message: 'Failed to get affiliate details', error: error.message });
  }
};

/**
 * Update affiliate status (activate/deactivate)
 */
exports.updateAffiliateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ message: 'is_active must be a boolean' });
    }
    
    const affiliate = await Affiliate.findById(id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    await db('affiliates').where({ id }).update({ is_active });
    
    // Log admin action
    await AdminAudit.log({
      admin_id: req.user.sub,
      target_user_id: affiliate.user_id,
      action: is_active ? 'AFFILIATE_ACTIVATE' : 'AFFILIATE_DEACTIVATE',
      metadata: {
        affiliate_id: id,
        referral_code: affiliate.referral_code
      }
    }).catch(() => {});
    
    const updatedAffiliate = await Affiliate.findById(id);
    
    res.json({
      message: `Affiliate ${is_active ? 'activated' : 'deactivated'} successfully`,
      affiliate: updatedAffiliate
    });
  } catch (error) {
    console.error('Admin update affiliate status error:', error);
    res.status(500).json({ message: 'Failed to update affiliate status', error: error.message });
  }
};

/**
 * Get commission settings
 */
exports.getCommissionSettings = async (req, res) => {
  try {
    const settings = await db('commission_settings')
      .where({ is_active: true })
      .orderBy('level', 'asc');
    
    const validation = await CommissionService.validateCommissionSettings();
    
    res.json({
      settings,
      validation
    });
  } catch (error) {
    console.error('Admin get commission settings error:', error);
    res.status(500).json({ message: 'Failed to get commission settings', error: error.message });
  }
};

/**
 * Update commission settings
 */
exports.updateCommissionSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!Array.isArray(settings)) {
      return res.status(400).json({ message: 'Settings must be an array' });
    }
    
    // Validate settings
    let totalRate = 0;
    for (const setting of settings) {
      if (typeof setting.level !== 'number' || typeof setting.rate !== 'number') {
        return res.status(400).json({ message: 'Invalid setting format' });
      }
      totalRate += setting.rate;
    }
    
    const maxTotalRate = settings[0]?.max_total_rate || 25.00;
    if (totalRate > maxTotalRate) {
      return res.status(400).json({ 
        message: `Total commission rate (${totalRate}%) exceeds maximum (${maxTotalRate}%)` 
      });
    }
    
    // Update settings in transaction
    await db.transaction(async (trx) => {
      // Deactivate all existing settings
      await trx('commission_settings').update({ is_active: false });
      
      // Insert new settings
      for (const setting of settings) {
        await trx('commission_settings').insert({
          level: setting.level,
          rate: setting.rate,
          max_total_rate: setting.max_total_rate || maxTotalRate,
          is_active: true
        });
      }
    });
    
    // Log admin action
    await AdminAudit.log({
      admin_id: req.user.sub,
      action: 'COMMISSION_SETTINGS_UPDATE',
      metadata: {
        new_settings: settings,
        total_rate: totalRate
      }
    }).catch(() => {});
    
    res.json({
      message: 'Commission settings updated successfully',
      total_rate: totalRate
    });
  } catch (error) {
    console.error('Admin update commission settings error:', error);
    res.status(500).json({ message: 'Failed to update commission settings', error: error.message });
  }
};

/**
 * Get pending withdrawals
 */
exports.getPendingWithdrawals = async (req, res) => {
  try {
    const withdrawals = await AffiliateWithdrawal.getPendingWithdrawals();
    res.json(withdrawals);
  } catch (error) {
    console.error('Admin get pending withdrawals error:', error);
    res.status(500).json({ message: 'Failed to get pending withdrawals', error: error.message });
  }
};

/**
 * List all withdrawals with filters
 */
exports.listWithdrawals = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, method, search = '' } = req.query;
    
    const withdrawals = await AffiliateWithdrawal.list({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      status,
      method,
      search
    });
    
    res.json(withdrawals);
  } catch (error) {
    console.error('Admin list withdrawals error:', error);
    res.status(500).json({ message: 'Failed to list withdrawals', error: error.message });
  }
};

/**
 * Get withdrawal details
 */
exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }
    
    // Get affiliate details
    const affiliate = await Affiliate.findById(withdrawal.affiliate_id);
    
    res.json({
      withdrawal,
      affiliate
    });
  } catch (error) {
    console.error('Admin get withdrawal details error:', error);
    res.status(500).json({ message: 'Failed to get withdrawal details', error: error.message });
  }
};

/**
 * Process withdrawal (approve/reject/complete)
 */
exports.processWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, processing_notes, transaction_reference } = req.body;
    
    if (!['APPROVE', 'REJECT', 'COMPLETE', 'CANCEL'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be APPROVE, REJECT, COMPLETE, or CANCEL' });
    }
    
    const withdrawal = await AffiliateWithdrawal.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ message: 'Withdrawal not found' });
    }
    
    const affiliate = await Affiliate.findById(withdrawal.affiliate_id);
    
    let newStatus;
    let balanceUpdate = null;
    
    switch (action) {
      case 'APPROVE':
        if (withdrawal.status !== 'PENDING') {
          return res.status(400).json({ message: 'Only pending withdrawals can be approved' });
        }
        newStatus = 'PROCESSING';
        break;
        
      case 'REJECT':
      case 'CANCEL':
        if (withdrawal.status === 'COMPLETED') {
          return res.status(400).json({ message: 'Cannot reject/cancel completed withdrawals' });
        }
        newStatus = 'CANCELLED';
        // Restore balance if not completed
        const currentBalance = parseFloat(affiliate.available_balance || 0);
        balanceUpdate = {
          available_balance: currentBalance + parseFloat(withdrawal.amount)
        };
        break;
        
      case 'COMPLETE':
        if (withdrawal.status !== 'PROCESSING') {
          return res.status(400).json({ message: 'Only processing withdrawals can be completed' });
        }
        newStatus = 'COMPLETED';
        break;
    }
    
    // Update withdrawal status
    await AffiliateWithdrawal.updateStatus(
      id,
      newStatus,
      req.user.sub,
      processing_notes,
      transaction_reference
    );
    
    // Update affiliate balance if needed
    if (balanceUpdate) {
      await Affiliate.updateBalances(affiliate.id, balanceUpdate);
    }
    
    // Log admin action
    await AdminAudit.log({
      admin_id: req.user.sub,
      target_user_id: affiliate.user_id,
      action: `WITHDRAWAL_${action}`,
      metadata: {
        withdrawal_id: id,
        amount: withdrawal.amount,
        method: withdrawal.method,
        status_before: withdrawal.status,
        status_after: newStatus
      }
    }).catch(() => {});
    
    // Send email notification
    try {
      const { sendMail } = require('../utils/email');
      const statusMessages = {
        'PROCESSING': 'Your withdrawal request has been approved and is being processed.',
        'COMPLETED': 'Your withdrawal has been completed successfully.',
        'CANCELLED': 'Your withdrawal request has been cancelled.'
      };
      
      await sendMail({
        to: affiliate.email,
        subject: `Withdrawal ${action === 'COMPLETE' ? 'Completed' : action === 'APPROVE' ? 'Approved' : 'Cancelled'}`,
        html: `
          <h2>Withdrawal Update</h2>
          <p>Hi ${affiliate.name},</p>
          <p>${statusMessages[newStatus] || 'Your withdrawal status has been updated.'}</p>
          <ul>
            <li><strong>Amount:</strong> $${parseFloat(withdrawal.amount).toFixed(2)}</li>
            <li><strong>Method:</strong> ${withdrawal.method}</li>
            <li><strong>Status:</strong> ${newStatus}</li>
            ${transaction_reference ? `<li><strong>Transaction Reference:</strong> ${transaction_reference}</li>` : ''}
            ${processing_notes ? `<li><strong>Notes:</strong> ${processing_notes}</li>` : ''}
          </ul>
          <p>Best regards,<br>KEOHAMS Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send withdrawal email:', emailError);
    }
    
    const updatedWithdrawal = await AffiliateWithdrawal.findById(id);
    
    res.json({
      message: `Withdrawal ${action.toLowerCase()}d successfully`,
      withdrawal: updatedWithdrawal
    });
  } catch (error) {
    console.error('Admin process withdrawal error:', error);
    res.status(500).json({ message: 'Failed to process withdrawal', error: error.message });
  }
};

/**
 * Get withdrawal statistics
 */
exports.getWithdrawalStats = async (req, res) => {
  try {
    const stats = await AffiliateWithdrawal.getSystemWithdrawalStats();
    res.json(stats);
  } catch (error) {
    console.error('Admin get withdrawal stats error:', error);
    res.status(500).json({ message: 'Failed to get withdrawal statistics', error: error.message });
  }
};

/**
 * Admin: Manually create affiliate sale
 * Used when admin needs to record a sale manually (e.g., offline sales)
 */
exports.createAffiliateSale = async (req, res) => {
  try {
    const { affiliate_id, customer_email, sale_reference, sale_amount, payment_method, payment_details, notes } = req.body;
    
    if (!affiliate_id || !sale_reference || !sale_amount || !payment_method) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const affiliate = await Affiliate.findById(affiliate_id);
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    let customer_id = null;
    if (customer_email) {
      const customer = await Users.findByEmail(customer_email);
      customer_id = customer?.id || null;
    }
    
    // Create sale directly as VERIFIED if admin creates it
    const sale = await CommissionService.processSale({
      affiliate_id,
      customer_id,
      sale_reference,
      sale_amount: parseFloat(sale_amount),
      payment_method,
      payment_details: payment_details || `Manually created by admin. ${notes || ''}`
    });
    
    // Auto-verify since admin created it
    await AffiliateSale.updateVerificationStatus(sale.id, 'VERIFIED', req.user.sub, notes || 'Admin created sale');
    
    // Calculate commissions immediately
    await CommissionService.calculateCommissions(sale.id);
    
    // Notify affiliate
    try {
      const Notifications = require('../models/notification');
      await Notifications.create({
        user_id: affiliate.user_id,
        title: 'New Sale Added',
        body: `Admin has recorded a new sale of $${parseFloat(sale_amount).toFixed(2)} for you. Commissions have been calculated.`,
        audience: 'USER',
        url: '/affiliate-dashboard'
      });
    } catch (notifErr) {
      console.warn('Failed to send notification:', notifErr);
    }
    
    res.status(201).json({
      message: 'Sale created and verified successfully',
      sale
    });
  } catch (error) {
    console.error('Create affiliate sale error:', error);
    res.status(500).json({ message: 'Failed to create sale', error: error.message });
  }
};

/**
 * Admin: Send notification to affiliate(s)
 */
exports.notifyAffiliates = async (req, res) => {
  try {
    const { target, affiliate_ids, title, body, url } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ message: 'Title and body are required' });
    }
    
    if (!['ALL', 'SPECIFIC'].includes(target)) {
      return res.status(400).json({ message: 'Target must be ALL or SPECIFIC' });
    }
    
    const Notifications = require('../models/notification');
    let notificationsSent = 0;
    
    if (target === 'ALL') {
      // Send to all affiliates
      const affiliates = await db('affiliates')
        .where({ is_active: true })
        .whereNotNull('user_id')
        .select('user_id');
      
      for (const aff of affiliates) {
        try {
          await Notifications.create({
            user_id: aff.user_id,
            title,
            body,
            audience: 'USER',
            url: url || '/affiliate-dashboard'
          });
          notificationsSent++;
        } catch (err) {
          console.warn(`Failed to notify affiliate user_id ${aff.user_id}:`, err);
        }
      }
    } else if (target === 'SPECIFIC') {
      if (!affiliate_ids || !Array.isArray(affiliate_ids) || affiliate_ids.length === 0) {
        return res.status(400).json({ message: 'affiliate_ids array required for SPECIFIC target' });
      }
      
      // Send to specific affiliates
      const affiliates = await db('affiliates')
        .whereIn('id', affiliate_ids)
        .whereNotNull('user_id')
        .select('id', 'user_id');
      
      for (const aff of affiliates) {
        try {
          await Notifications.create({
            user_id: aff.user_id,
            title,
            body,
            audience: 'USER',
            url: url || '/affiliate-dashboard'
          });
          notificationsSent++;
        } catch (err) {
          console.warn(`Failed to notify affiliate ${aff.id}:`, err);
        }
      }
    }
    
    res.json({
      message: 'Notifications sent successfully',
      notifications_sent: notificationsSent
    });
  } catch (error) {
    console.error('Notify affiliates error:', error);
    res.status(500).json({ message: 'Failed to send notifications', error: error.message });
  }
};

/**
 * Recalculate all commissions (DESTRUCTIVE - use with caution)
 * This will delete all existing commission records and regenerate them from verified sales
 */
exports.recalculateAllCommissions = async (req, res) => {
  try {
    const commissionService = require('../services/commissionService');
    
    // Start transaction
    await db.transaction(async (trx) => {
      // 1. Delete all existing commission records
      await trx('commission_records').del();
      
      // 2. Reset all affiliate balances
      await trx('affiliates').update({
        total_earnings: 0,
        available_balance: 0,
        pending_balance: 0
      });
      
      // 3. Get all verified sales
      const verifiedSales = await trx('affiliate_sales')
        .where('verification_status', 'VERIFIED')
        .select('id', 'amount');
      
      let commissionsCreated = 0;
      
      // 4. Recalculate commissions for each verified sale
      for (const sale of verifiedSales) {
        try {
          await commissionService.calculateAndStoreCommissions(sale.id, sale.amount, trx);
          commissionsCreated++;
        } catch (error) {
          console.error(`Failed to recalculate commissions for sale ${sale.id}:`, error.message);
          // Continue with other sales even if one fails
        }
      }
      
      return { 
        sales_count: verifiedSales.length,
        commissions_created: commissionsCreated
      };
    }).then((result) => {
      res.json({
        message: 'Commissions recalculated successfully',
        ...result
      });
    });
  } catch (error) {
    console.error('Commission recalculation error:', error);
    res.status(500).json({ 
      message: 'Failed to recalculate commissions', 
      error: error.message 
    });
  }
};
