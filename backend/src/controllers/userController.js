const Users = require('../models/user');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../config/db');
const { sendMail } = require('../utils/email');

async function generateRecoveryCodes(userId, count = 8) {
  // Invalidate old unused codes
  // (Option: leave used codes for audit; we'll just leave them.)
  const codes = [];
  for (let i = 0; i < count; i++) {
    // 10-char human friendly code groups
    const raw = Math.random().toString(36).slice(2, 10).toUpperCase();
    const hash = await bcrypt.hash(raw, 10);
    await db('twofa_recovery_codes').insert({ user_id: userId, code_hash: hash });
    codes.push(raw);
  }
  return codes;
}

exports.getProfile = async (req, res) => {
  const user = await Users.findById(req.user.sub);
  if (!user) return res.status(404).json({ message: 'Not found' });
  
  // Get KYC status
  const kycSubmission = await db('kyc_submissions')
    .where({ user_id: req.user.sub })
    .orderBy('created_at', 'desc')
    .first();
  
  const kycStatus = {
    submitted: !!kycSubmission,
    status: kycSubmission?.status || 'NOT_SUBMITTED',
    submittedAt: kycSubmission?.created_at || null,
    reviewedAt: kycSubmission?.reviewed_at || null,
    adminRemarks: kycSubmission?.admin_remarks || null,
    autoDecision: kycSubmission?.auto_decision || null,
    canResubmit: kycSubmission?.status === 'REJECTED'
  };
  
  res.json({ 
    id: user.id, 
    name: user.name, 
    email: user.email, 
    phone: user.phone, 
    address: user.address, 
    dob: user.dob, 
    avatar_url: user.avatar_url, 
    twofa_enabled: !!user.twofa_secret,
    email_2fa_enabled: !!user.email_2fa_enabled,
    email_2fa_method: user.email_2fa_method || null,
    kyc: kycStatus
  });
};

exports.updateProfile = async (req, res) => {
  const { name, phone, address, dob } = req.body;
  await Users.update(req.user.sub, { name, phone, address, dob });
  const user = await Users.findById(req.user.sub);
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, dob: user.dob, avatar_url: user.avatar_url, twofa_enabled: !!user.twofa_secret });
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
  const secret = speakeasy.generateSecret({ name: process.env.TWOFA_ISSUER || 'KEOHAMS', length: 20 });
  const qr = await qrcode.toDataURL(secret.otpauth_url);
  res.json({ base32: secret.base32, otpauth_url: secret.otpauth_url, qr });
};

exports.twofaEnable = async (req, res) => {
  const { base32, token } = req.body;
  if (!base32 || !token) return res.status(400).json({ message: 'Missing fields' });
  const verified = speakeasy.totp.verify({ secret: base32, encoding: 'base32', token, window: 1 });
  if (!verified) return res.status(400).json({ message: 'Invalid code' });
  await Users.update(req.user.sub, { twofa_secret: base32 });
  // Clear any existing recovery codes (soft: just delete unused ones)
  await db('twofa_recovery_codes').where({ user_id: req.user.sub, used: 0 }).del();
  const recoveryCodes = await generateRecoveryCodes(req.user.sub);
  // Audit log
  try { await db('admin_audit_events').insert({ admin_id: null, target_user_id: req.user.sub, action: 'TWOFA_ENABLE', metadata: JSON.stringify({ ts: new Date().toISOString() }) }); } catch(_){ }
  // Email notification (best-effort)
  try {
    const user = await Users.findById(req.user.sub);
    if (user?.email) {
      await sendMail({
        to: user.email,
        subject: '2FA Enabled on Your Account',
        html: `<p>Hello ${user.name || ''},</p><p>Two-Factor Authentication (TOTP) was just <strong>enabled</strong> on your account.</p><p>If you performed this action, no further steps are needed. If not, please disable it immediately and contact support.</p><p>Time: ${new Date().toUTCString()}</p><p>— KEOHAMS Security</p>`
      });
    }
  } catch(e){ console.warn('TwoFA enable email failed:', e.message); }
  res.json({ message: '2FA enabled', recovery_codes: recoveryCodes });
};

exports.twofaDisable = async (req, res) => {
  await Users.update(req.user.sub, { twofa_secret: null });
  await db('twofa_recovery_codes').where({ user_id: req.user.sub }).del();
  try { await db('admin_audit_events').insert({ admin_id: null, target_user_id: req.user.sub, action: 'TWOFA_DISABLE', metadata: JSON.stringify({ ts: new Date().toISOString() }) }); } catch(_){ }
  try {
    const user = await Users.findById(req.user.sub);
    if (user?.email) {
      await sendMail({
        to: user.email,
        subject: '2FA Disabled on Your Account',
        html: `<p>Hello ${user.name || ''},</p><p>Two-Factor Authentication (TOTP) was just <strong>disabled</strong> on your account.</p><p>If you made this change intentionally, you may ignore this message. If this was not you, we strongly recommend re-enabling 2FA and changing your password.</p><p>Time: ${new Date().toUTCString()}</p><p>— KEOHAMS Security</p>`
      });
    }
  } catch(e){ console.warn('TwoFA disable email failed:', e.message); }
  res.json({ message: '2FA disabled' });
};

// List current unused recovery codes (NOT hashes) - cannot retrieve original so we force regeneration path
exports.getRecoveryCodes = async (req, res) => {
  // We cannot show existing raw codes (only hashes stored). Offer regeneration instead.
  const user = await Users.findById(req.user.sub);
  if (!user.twofa_secret) return res.status(400).json({ message: '2FA not enabled' });
  return res.json({ message: 'Recovery codes cannot be retrieved once generated. Regenerate to obtain a new set.' });
};

exports.regenerateRecoveryCodes = async (req, res) => {
  const user = await Users.findById(req.user.sub);
  if (!user.twofa_secret) return res.status(400).json({ message: '2FA not enabled' });
  await db('twofa_recovery_codes').where({ user_id: req.user.sub, used: 0 }).del();
  const codes = await generateRecoveryCodes(req.user.sub);
  res.json({ message: 'Recovery codes regenerated', recovery_codes: codes });
};

exports.uploadAvatar = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  try {
    const rel = `/uploads/${req.file.filename}`;
    await Users.updateAvatar(req.user.sub, rel);
    res.json({ message: 'Avatar updated', avatar_url: rel });
  } catch (e) {
    console.error('Avatar upload failed (likely missing column or DB error):', e.message);
    return res.status(500).json({ message: 'Avatar storage failed', detail: e.message });
  }
};

// Email 2FA functions
exports.enableEmail2FA = async (req, res) => {
  try {
    const user = await Users.findById(req.user.sub);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Generate and send verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Store code
    await db('email_2fa_codes').insert({
      user_id: user.id,
      code,
      purpose: 'verification',
      expires_at: expiresAt
    });
    
    // Send code via email
    await sendMail({
      to: user.email,
      subject: 'Enable Email 2FA - Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2f5337;">Enable Email Two-Factor Authentication</h2>
          <p>Hello ${user.name || ''},</p>
          <p>You requested to enable email-based two-factor authentication on your KEOHAMS account.</p>
          <div style="background: #f5f7fa; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #2f5337; letter-spacing: 4px;">${code}</div>
            <p style="color: #666; margin-top: 10px;">This code expires in 10 minutes</p>
          </div>
          <p>Enter this code in your settings page to complete the setup.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email and ensure your account is secure.</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} KEOHAMS. All rights reserved.</p>
        </div>
      `
    });
    
    res.json({ message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Enable email 2FA error:', error);
    res.status(500).json({ message: 'Failed to enable email 2FA' });
  }
};

exports.verifyAndEnableEmail2FA = async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ message: 'Verification code required' });
  }
  
  try {
    // Find valid code
    const codeRecord = await db('email_2fa_codes')
      .where({
        user_id: req.user.sub,
        code,
        purpose: 'verification',
        used: false
      })
      .where('expires_at', '>', db.fn.now())
      .first();
    
    if (!codeRecord) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }
    
    // Mark code as used
    await db('email_2fa_codes')
      .where({ id: codeRecord.id })
      .update({ used: true });
    
    // Enable email 2FA for user
    await Users.update(req.user.sub, { 
      email_2fa_enabled: true,
      email_2fa_method: 'email'
    });
    
    // Audit log
    try {
      await db('admin_audit_events').insert({
        admin_id: null,
        target_user_id: req.user.sub,
        action: 'EMAIL_2FA_ENABLE',
        metadata: JSON.stringify({ ts: new Date().toISOString() })
      });
    } catch(_) {}
    
    // Send confirmation email
    const user = await Users.findById(req.user.sub);
    try {
      await sendMail({
        to: user.email,
        subject: 'Email 2FA Enabled',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2f5337;">Email 2FA Enabled Successfully</h2>
            <p>Hello ${user.name || ''},</p>
            <p>Email-based two-factor authentication has been enabled on your KEOHAMS account.</p>
            <p>From now on, you'll receive a verification code via email each time you sign in.</p>
            <p style="color: #666; font-size: 14px;">If you didn't enable this, please contact support immediately.</p>
            <p>Time: ${new Date().toUTCString()}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} KEOHAMS Security</p>
          </div>
        `
      });
    } catch(e) {
      console.warn('Email 2FA enable notification failed:', e.message);
    }
    
    res.json({ message: 'Email 2FA enabled successfully' });
  } catch (error) {
    console.error('Verify email 2FA error:', error);
    res.status(500).json({ message: 'Failed to verify code' });
  }
};

exports.disableEmail2FA = async (req, res) => {
  try {
    await Users.update(req.user.sub, { 
      email_2fa_enabled: false,
      email_2fa_method: null
    });
    
    // Audit log
    try {
      await db('admin_audit_events').insert({
        admin_id: null,
        target_user_id: req.user.sub,
        action: 'EMAIL_2FA_DISABLE',
        metadata: JSON.stringify({ ts: new Date().toISOString() })
      });
    } catch(_) {}
    
    // Send notification
    const user = await Users.findById(req.user.sub);
    try {
      await sendMail({
        to: user.email,
        subject: 'Email 2FA Disabled',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #c87f0a;">Email 2FA Disabled</h2>
            <p>Hello ${user.name || ''},</p>
            <p>Email-based two-factor authentication has been disabled on your KEOHAMS account.</p>
            <p style="color: #666; font-size: 14px;">If you didn't make this change, please enable it again and contact support.</p>
            <p>Time: ${new Date().toUTCString()}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} KEOHAMS Security</p>
          </div>
        `
      });
    } catch(e) {
      console.warn('Email 2FA disable notification failed:', e.message);
    }
    
    res.json({ message: 'Email 2FA disabled successfully' });
  } catch (error) {
    console.error('Disable email 2FA error:', error);
    res.status(500).json({ message: 'Failed to disable email 2FA' });
  }
};
