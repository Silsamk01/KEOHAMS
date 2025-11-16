const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const Users = require('../models/user');
const { sign } = require('../utils/jwt');
const { sendMail } = require('../utils/email');
const { logActivity } = require('../services/activityLogger');
const SecurityService = require('../services/securityService');

// simple tokens table for email verification and password reset
async function ensureTokensTable() {
  const exists = await db.schema.hasTable('tokens');
  if (!exists) {
    await db.schema.createTable('tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('type').notNullable(); // 'verify-email' | 'password-reset'
      t.string('token').notNullable().unique();
      t.dateTime('expires_at').notNullable();
      t.timestamps(true, true);
    });
  }
}

const { verifyCaptcha } = require('../utils/captcha');

exports.register = async (req, res) => {
  let { name, email, password, phone, address, dob, captchaToken, captchaAnswer, referral_code } = req.body;
  if (!name || !email || !password || !dob) return res.status(400).json({ message: 'Missing fields' });
  // Basic normalization / trimming to reduce accidental whitespace & simple injection vectors
  name = String(name).trim();
  email = String(email).trim().toLowerCase();
  if (phone) phone = String(phone).trim();
  if (address) address = String(address).trim();
  // Capture referral code from query param or body
  referral_code = referral_code || req.query.ref || null;
  if (referral_code) referral_code = String(referral_code).trim().toUpperCase();

  // Password complexity: at least 8 chars, one upper, one lower, one number, one symbol
  const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  if (!complexity.test(password)) {
    return res.status(400).json({ message: 'Password too weak (min 8 chars incl. upper, lower, number, symbol)' });
  }
  try { verifyCaptcha(captchaToken, captchaAnswer); } catch (e) { return res.status(400).json({ message: e.message }); }
  // Validate age >= 18
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return res.status(400).json({ message: 'Invalid date of birth' });
  const now = new Date();
  const age = now.getFullYear() - birth.getFullYear() - ((now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) ? 1 : 0);
  if (age < 18) return res.status(403).json({ message: 'You must be at least 18 years old to register' });

  // ensure email not already in use
  const existing = await Users.findByEmail(email);
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  // store pending registration and send verification email with token
  const password_hash = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await db('pending_registrations').insert({ name, email, password_hash, phone, address, dob, referral_code, token, expires_at: expires });
  const verifyUrl = `${req.protocol}://${req.get('host')}/verify?token=${token}&flow=pending`;
  try {
    await sendMail({
      to: email,
      subject: 'Verify your email',
      html: `<p>Hello ${name},</p><p>Please verify your email by clicking <a href="${verifyUrl}">this link</a>.</p>`
    });
  } catch (e) {
    // continue even if email send fails in dev
    console.warn('Email send failed:', e.message);
    console.info('[DEV ONLY] Verification link:', verifyUrl);
  }

  return res.status(201).json({ message: 'Registered. Please verify your email.' });
};

exports.login = async (req, res) => {
  const { email, password, captchaToken, captchaAnswer, twofa_token, recovery_code } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try { verifyCaptcha(captchaToken, captchaAnswer); } catch (e) { return res.status(400).json({ message: e.message }); }
  
  const user = await Users.findByEmail(email);
  const ipAddress = req.ip || req.connection?.remoteAddress;
  
  if (!user) {
    // Record failed login attempt
    await SecurityService.recordLoginAttempt(email, ipAddress, false, 'User not found');
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  // Check if account is locked
  const isLocked = await SecurityService.isAccountLocked(user.id);
  if (isLocked) {
    await SecurityService.recordLoginAttempt(email, ipAddress, false, 'Account locked');
    return res.status(403).json({ message: 'Account locked due to suspicious activity. Please contact support.' });
  }
  
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await SecurityService.recordLoginAttempt(email, ipAddress, false, 'Invalid password');
    await SecurityService.logSecurityEvent('LOGIN_FAILED', user.id, { reason: 'Invalid password' }, req, 'MEDIUM');
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  
  if (user.is_active === 0 || user.is_active === false) {
    await SecurityService.recordLoginAttempt(email, ipAddress, false, 'Account inactive');
    return res.status(403).json({ message: 'Account inactive. Awaiting admin activation.' });
  }

  // If user has 2FA enabled, require token or recovery code
  if (user.twofa_secret) {
    // If provided in same step, allow direct verification
    if (twofa_token || recovery_code) {
      try {
        const verified = await verifyTwoFactor(user, twofa_token, recovery_code);
        if (!verified.ok) return res.status(401).json({ message: verified.message || 'Invalid 2FA' });
      } catch (e) {
        return res.status(500).json({ message: '2FA check failed' });
      }
    } else {
      // Return early telling client to prompt for second factor
      return res.status(200).json({ twofa_required: true, user_hint: { id: user.id, email: user.email, name: user.name } });
    }
  }

  const token = sign({ sub: user.id, role: user.role, tv: user.token_version || 1 });
  
  // Record successful login
  await SecurityService.recordLoginAttempt(email, ipAddress, true);
  await SecurityService.resetFailedLoginAttempts(user.id);
  await SecurityService.logSecurityEvent('LOGIN_SUCCESS', user.id, { method: '2FA enabled: ' + !!user.twofa_secret }, req, 'LOW');
  
  // Check for suspicious activity
  await SecurityService.detectSuspiciousActivity(user.id, req);
  
  // Log successful login activity
  await logActivity({
    user_id: user.id,
    user_type: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    action: 'LOGIN',
    description: `${user.name} logged in`,
    ip_address: ipAddress,
    user_agent: req.headers['user-agent']
  });
  
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
};

// INTERNAL helper for verifying 2FA TOTP or recovery code usage
const speakeasy = require('speakeasy');
async function verifyTwoFactor(user, twofa_token, recovery_code) {
  if (!user.twofa_secret) return { ok: true };
  if (twofa_token) {
    const valid = speakeasy.totp.verify({ secret: user.twofa_secret, encoding: 'base32', token: twofa_token, window: 1 });
    if (!valid) return { ok: false, message: 'Invalid 2FA token' };
    return { ok: true };
  }
  if (recovery_code) {
    // Lookup hashed recovery codes
    try {
      const row = await db('twofa_recovery_codes').where({ user_id: user.id, used: 0 }).select('*');
      if (!row || !row.length) return { ok: false, message: 'No recovery codes available' };
      const bcrypt = require('bcryptjs');
      for (const codeRow of row) {
        const match = await bcrypt.compare(recovery_code, codeRow.code_hash);
        if (match) {
          await db('twofa_recovery_codes').where({ id: codeRow.id }).update({ used: 1, used_at: db.fn.now() });
          return { ok: true };
        }
      }
      return { ok: false, message: 'Invalid recovery code' };
    } catch (e) {
      return { ok: false, message: 'Recovery code check failed' };
    }
  }
  return { ok: false, message: '2FA token required' };
}

// Separate endpoint if client prefers a two-step flow (login step 1 returns twofa_required)
exports.verifySecondFactor = async (req, res) => {
  const { email, password, twofa_token, recovery_code, captchaToken, captchaAnswer } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try { verifyCaptcha(captchaToken, captchaAnswer); } catch (e) { return res.status(400).json({ message: e.message }); }
  const user = await Users.findByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  if (!user.twofa_secret) {
    // 2FA not enabled, just issue token
  const token = sign({ sub: user.id, role: user.role, tv: user.token_version || 1 });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  }
  const verified = await verifyTwoFactor(user, twofa_token, recovery_code);
  if (!verified.ok) return res.status(401).json({ message: verified.message || 'Invalid 2FA' });
  const token = sign({ sub: user.id, role: user.role, tv: user.token_version || 1 });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
};

exports.verifyEmail = async (req, res) => {
  const { token, flow } = req.query;
  if (!token) return res.status(400).json({ message: 'Token required' });
  if (flow === 'pending') {
    const row = await db('pending_registrations').where({ token }).first();
    if (!row) return res.status(400).json({ message: 'Invalid token' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'Token expired' });
    // create user now and mark email verified
    const [userId] = await Users.create({
      name: row.name,
      email: row.email,
      password_hash: row.password_hash,
      phone: row.phone,
      address: row.address,
      dob: row.dob,
      role: 'CUSTOMER',
      email_verified: 1,
      is_active: 1
    });
  await db('pending_registrations').where({ id: row.id }).del();
  const userRow = await Users.findById(userId);
  const tokenJwt = sign({ sub: userId, role: 'CUSTOMER', tv: userRow?.token_version || 1 });
  return res.json({ message: 'Email verified. Account created.', token: tokenJwt });
  } else {
    const row = await db('tokens').where({ token, type: 'verify-email' }).first();
    if (!row) return res.status(400).json({ message: 'Invalid token' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'Token expired' });
    await Users.verifyEmail(row.user_id);
    await db('tokens').where({ id: row.id }).del();
    return res.json({ message: 'Email verified' });
  }
};

exports.me = async (req, res) => {
  const user = await Users.findById(req.user.sub);
  if (!user) return res.status(404).json({ message: 'Not found' });
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    email_verified: !!user.email_verified,
    avatar_url: user.avatar_url
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });
  const user = await Users.findByEmail(email);
  // Respond with 200 regardless to prevent user enumeration
  if (!user) return res.json({ message: 'If an account exists, a reset link has been sent' });

  await ensureTokensTable();
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 minutes
  await db('tokens').insert({ user_id: user.id, type: 'password-reset', token, expires_at: expires });

  const resetUrl = `${req.protocol}://${req.get('host')}/reset?token=${token}`;
  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your password',
      html: `<p>Hello ${user.name || ''},</p><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 30 minutes.</p>`
    });
  } catch (e) {
    console.warn('Reset email send failed:', e.message);
    console.info('[DEV ONLY] Reset link:', resetUrl);
  }
  return res.json({ message: 'Check your email for a link. If it doesn\'t appear within a few minutes, check your spam folder and if in Spam move to inbox.' });
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
  const row = await db('tokens').where({ token, type: 'password-reset' }).first();
  if (!row) return res.status(400).json({ message: 'Invalid token' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'Token expired' });

  const hash = await bcrypt.hash(password, 10);
  // bump token_version to invalidate old tokens
  const user = await Users.findById(row.user_id);
  await Users.update(row.user_id, { password_hash: hash, token_version: (user?.token_version || 1) + 1 });
  try { await db('admin_audit_events').insert({ admin_id: null, target_user_id: row.user_id, action: 'PASSWORD_RESET', metadata: JSON.stringify({ self_service: true }) }); } catch(_){}
  await db('tokens').where({ id: row.id }).del();
  return res.json({ message: 'Password updated successfully' });
};
