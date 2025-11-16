const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const Affiliate = require('../models/affiliate');
const { sign } = require('../utils/jwt');
const { sendMail } = require('../utils/email');
const { verifyCaptcha } = require('../utils/captcha');
const { logActivity } = require('../services/activityLogger');

/**
 * Register a new standalone affiliate
 */
exports.register = async (req, res) => {
  console.log('[REGISTER] Controller reached');
  console.log('[REGISTER] Request body:', { ...req.body, password: req.body?.password ? '[HIDDEN]' : undefined });
  console.log('[REGISTER] Request method:', req.method);
  console.log('[REGISTER] Request path:', req.path);
  
  try {
    let { name, email, password, phone, parent_referral_code, captchaToken, captchaAnswer, termsAccepted } = req.body;
    
    console.log('[REGISTER] Parsed data:', { name, email, hasPassword: !!password, phone, parent_referral_code, termsAccepted });
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields: name, email, password' });
    }
    
    // Require terms acceptance
    if (!termsAccepted) {
      return res.status(400).json({ message: 'You must accept the Terms & Conditions and Privacy Policy to register' });
    }
    
    // Normalize inputs
    name = String(name).trim();
    email = String(email).trim().toLowerCase();
    if (phone) phone = String(phone).trim();
    
    // Password complexity check
    const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!complexity.test(password)) {
      return res.status(400).json({ 
        message: 'Password too weak (min 8 chars incl. upper, lower, number, symbol)' 
      });
    }
    
    // Verify captcha (optional for now - can be made required later)
    if (captchaToken && captchaAnswer) {
      try {
        verifyCaptcha(captchaToken, captchaAnswer);
      } catch (e) {
        return res.status(400).json({ message: e.message });
      }
    }
    
    // Check if email already exists as affiliate
    let existingAffiliate;
    try {
      const hasDeletedAt = await db.schema.hasColumn('affiliates', 'deleted_at');
      if (hasDeletedAt) {
        existingAffiliate = await db('affiliates')
          .where({ email })
          .whereNull('deleted_at')
          .first();
      } else {
        existingAffiliate = await db('affiliates')
          .where({ email })
          .first();
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ 
        message: 'Database error. Please ensure migrations have been run.',
        error: dbError.message
      });
    }
    
    if (existingAffiliate) {
      return res.status(409).json({ message: 'Email already registered as affiliate' });
    }
    
    // Check if email exists as shop user (optional - can link later)
    let existingUser;
    try {
      const hasDeletedAt = await db.schema.hasColumn('users', 'deleted_at');
      if (hasDeletedAt) {
        existingUser = await db('users')
          .where({ email })
          .whereNull('deleted_at')
          .first();
      } else {
        existingUser = await db('users')
          .where({ email })
          .first();
      }
    } catch (dbError) {
      console.error('Database query error for users:', dbError);
      // Continue - this is optional
      existingUser = null;
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Generate email verification token
    const token = crypto.randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    
    // Find parent affiliate if referral code provided
    let parent_affiliate_id = null;
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
    
    // Create affiliate account (unverified)
    const affiliateData = {
      email,
      password_hash,
      name,
      phone: phone || null,
      user_id: existingUser ? existingUser.id : null, // Link to user if exists
      parent_affiliate_id,
      email_verified: false,
      token_version: 1,
      is_active_account: true
    };
    
    // Generate referral code
    let referral_code;
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      referral_code = Affiliate.generateReferralCode();
      const existing = await db('affiliates').where({ referral_code }).first();
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return res.status(500).json({ message: 'Failed to generate unique referral code' });
    }
    
    affiliateData.referral_code = referral_code;
    affiliateData.total_earnings = 0;
    affiliateData.available_balance = 0;
    affiliateData.pending_balance = 0;
    affiliateData.direct_referrals = 0;
    affiliateData.total_downline = 0;
    affiliateData.is_active = true;
    
    // Check if migration has been run (check if email column exists)
    const hasEmailColumn = await db.schema.hasColumn('affiliates', 'email');
    if (!hasEmailColumn) {
      console.error('Migration not run: affiliates table missing email column');
      return res.status(500).json({ 
        message: 'Database migration required. Please run: npm run migrate',
        error: 'Missing required database columns'
      });
    }
    
    let affiliateId;
    try {
      [affiliateId] = await db('affiliates').insert(affiliateData);
    } catch (dbError) {
      console.error('Database insert error:', dbError);
      console.error('Attempted data:', { ...affiliateData, password_hash: '[HIDDEN]' });
      return res.status(500).json({ 
        message: 'Failed to create affiliate account',
        error: dbError.message,
        details: process.env.NODE_ENV === 'development' ? dbError.stack : undefined
      });
    }
    
    // Store email verification token (ensure table exists)
    try {
      const hasTable = await db.schema.hasTable('affiliate_verification_tokens');
      if (hasTable) {
        await db('affiliate_verification_tokens').insert({
          affiliate_id: affiliateId,
          token,
          expires_at: expires,
          type: 'verify-email'
        });
      } else {
        console.warn('affiliate_verification_tokens table does not exist. Run migrations.');
      }
    } catch (tokenError) {
      console.error('Failed to store verification token:', tokenError);
      // Continue - token can be regenerated if needed
    }
    
    // Update parent's direct referrals count
    if (parent_affiliate_id) {
      await db('affiliates')
        .where({ id: parent_affiliate_id })
        .increment('direct_referrals', 1);
      
      // Update all upline total_downline counts
      await Affiliate.updateUplineDownlineCounts(parent_affiliate_id);
    }
    
    // Send verification email
    const verifyUrl = `${req.protocol}://${req.get('host')}/affiliate-verify?token=${token}`;
    try {
      await sendMail({
        to: email,
        subject: 'Verify your KEOHAMS Affiliate Account',
        html: `
          <h2>Welcome to KEOHAMS Affiliate Program!</h2>
          <p>Hi ${name},</p>
          <p>Thank you for joining the KEOHAMS affiliate program. Please verify your email to activate your account.</p>
          <p><strong>Your unique referral code:</strong> ${referral_code}</p>
          <p><a href="${verifyUrl}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a></p>
          <p>Or copy this link: ${verifyUrl}</p>
          <p>Best regards,<br>KEOHAMS Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Continue - email can be resent later
    }
    
    res.status(201).json({
      message: 'Check your email for a link. If it doesn\'t appear within a few minutes, check your spam folder and if in Spam move to inbox.',
      affiliate: {
        id: affiliateId,
        referral_code: referral_code,
        email: email,
        name: name
      }
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Don't let errors be converted to 401 - return appropriate status
    const statusCode = error.status || error.statusCode || 500;
    
    // Ensure we return proper error format
    if (res.headersSent) {
      return;
    }
    
    res.status(statusCode).json({ 
      success: false,
      message: 'Failed to register affiliate', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Login for standalone affiliates
 */
exports.login = async (req, res) => {
  try {
    const { email, password, captchaToken, captchaAnswer } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }
    
    // Verify captcha (optional for now - can be made required later)
    if (captchaToken && captchaAnswer) {
      try {
        verifyCaptcha(captchaToken, captchaAnswer);
      } catch (e) {
        return res.status(400).json({ message: e.message });
      }
    }
    
    // Find affiliate by email
    let affiliate;
    try {
      const hasDeletedAt = await db.schema.hasColumn('affiliates', 'deleted_at');
      if (hasDeletedAt) {
        affiliate = await db('affiliates')
          .where({ email: email.toLowerCase().trim() })
          .whereNull('deleted_at')
          .first();
      } else {
        affiliate = await db('affiliates')
          .where({ email: email.toLowerCase().trim() })
          .first();
      }
    } catch (dbError) {
      console.error('Database query error:', dbError);
      return res.status(500).json({ 
        message: 'Database error. Please ensure migrations have been run.',
        error: dbError.message
      });
    }
    
    if (!affiliate) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if affiliate has password (standalone account)
    if (!affiliate.password_hash) {
      return res.status(401).json({ 
        message: 'This affiliate account is linked to a shop account. Please use shop login.' 
      });
    }
    
    // Verify password
    const ok = await bcrypt.compare(password, affiliate.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check if account is active
    if (affiliate.is_active_account === false || affiliate.is_active_account === 0) {
      return res.status(403).json({ message: 'Account inactive. Please contact support.' });
    }
    
    // Check if email is verified
    if (!affiliate.email_verified) {
      return res.status(403).json({ 
        message: 'Check your email for a link. If it doesn\'t appear within a few minutes, check your spam folder and if in Spam move to inbox.',
        requires_verification: true
      });
    }
    
    // Generate JWT token
    const token = sign({ 
      sub: affiliate.id, 
      role: 'AFFILIATE',
      type: 'affiliate',
      tv: affiliate.token_version || 1 
    });
    
    // Log successful affiliate login
    await logActivity({
      user_id: affiliate.user_id || null, // Use user_id from affiliate record, not affiliate.id
      user_type: 'AFFILIATE',
      action: 'LOGIN',
      description: `${affiliate.name} logged in`,
      ip_address: req.ip || req.connection?.remoteAddress,
      user_agent: req.headers['user-agent']
    });
    
    return res.json({
      token,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        email: affiliate.email,
        referral_code: affiliate.referral_code,
        phone: affiliate.phone
      }
    });
  } catch (error) {
    console.error('Affiliate login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

/**
 * Verify affiliate email
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    console.log('[VERIFY] Email verification attempt, token:', token ? 'present' : 'missing');
    
    if (!token) {
      // Serve the verification page with error
      return res.sendFile(
        require('path').join(__dirname, '..', '..', '..', 'frontend', 'pages', 'affiliate-verify.html'),
        (err) => {
          if (err) {
            return res.status(400).json({ message: 'Verification token required' });
          }
        }
      );
    }
    
    // Check if verification tokens table exists
    const hasTokensTable = await db.schema.hasTable('affiliate_verification_tokens');
    if (!hasTokensTable) {
      console.error('[VERIFY] affiliate_verification_tokens table does not exist');
      return res.status(500).json({ 
        message: 'Verification system not initialized. Please contact support.',
        error: 'Database table missing'
      });
    }
    
    // Find token
    const tokenRecord = await db('affiliate_verification_tokens')
      .where({ token, type: 'verify-email' })
      .where('expires_at', '>', db.fn.now())
      .first();
    
    if (!tokenRecord) {
      console.log('[VERIFY] Invalid or expired token');
      // Serve the verification page - it will handle the error via query param
      return res.sendFile(
        require('path').join(__dirname, '..', '..', '..', 'frontend', 'pages', 'affiliate-verify.html')
      );
    }
    
    console.log('[VERIFY] Token found, affiliate_id:', tokenRecord.affiliate_id);
    
    // Update affiliate
    await db('affiliates')
      .where({ id: tokenRecord.affiliate_id })
      .update({
        email_verified: true,
        email_verified_at: db.fn.now()
      });
    
    // Delete token
    await db('affiliate_verification_tokens')
      .where({ id: tokenRecord.id })
      .delete();
    
    // Auto-login the affiliate
    const affiliate = await db('affiliates').where({ id: tokenRecord.affiliate_id }).first();
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate account not found' });
    }
    
    const authToken = sign({ 
      sub: affiliate.id, 
      role: 'AFFILIATE',
      type: 'affiliate',
      tv: affiliate.token_version || 1 
    });
    
    console.log('[VERIFY] Email verified successfully, redirecting to dashboard');
    
    // Redirect to verification page with success status and auth token
    return res.redirect(`/affiliate-verify?verified=true&authToken=${authToken}`);
  } catch (error) {
    console.error('[VERIFY] Email verification error:', error);
    console.error('[VERIFY] Error stack:', error.stack);
    
    // Try to serve the verification page with error
    try {
      return res.sendFile(
        require('path').join(__dirname, '..', '..', '..', 'frontend', 'pages', 'affiliate-verify.html')
      );
    } catch (fileError) {
      return res.status(500).json({ 
        message: 'Verification failed', 
        error: error.message 
      });
    }
  }
};

/**
 * Get current affiliate profile
 */
exports.me = async (req, res) => {
  try {
    const affiliate = await db('affiliates')
      .where({ id: req.affiliate.id })
      .whereNull('deleted_at')
      .first();
    
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    // Remove sensitive data
    delete affiliate.password_hash;
    
    res.json({ affiliate });
  } catch (error) {
    console.error('Get affiliate profile error:', error);
    res.status(500).json({ message: 'Failed to get profile', error: error.message });
  }
};

