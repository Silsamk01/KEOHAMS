const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const Users = require('../models/user');
const { sign } = require('../utils/jwt');
const { sendMail } = require('../utils/email');

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
  const { name, email, password, phone, address, dob, captchaToken, captchaAnswer } = req.body;
  if (!name || !email || !password || !dob) return res.status(400).json({ message: 'Missing fields' });
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

  await db('pending_registrations').insert({ name, email, password_hash, phone, address, dob, token, expires_at: expires });
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
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

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

  const token = sign({ sub: user.id, role: user.role });
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
  const token = sign({ sub: user.id, role: user.role });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url } });
  }
  const verified = await verifyTwoFactor(user, twofa_token, recovery_code);
  if (!verified.ok) return res.status(401).json({ message: verified.message || 'Invalid 2FA' });
  const token = sign({ sub: user.id, role: user.role });
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
      email_verified: 1
    });
  await db('pending_registrations').where({ id: row.id }).del();
  const tokenJwt = sign({ sub: userId, role: 'CUSTOMER' });
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
  return res.json({ message: 'If an account exists, a reset link has been sent' });
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: 'Token and password required' });
  const row = await db('tokens').where({ token, type: 'password-reset' }).first();
  if (!row) return res.status(400).json({ message: 'Invalid token' });
  if (new Date(row.expires_at) < new Date()) return res.status(400).json({ message: 'Token expired' });

  const hash = await bcrypt.hash(password, 10);
  await Users.updatePassword(row.user_id, hash);
  await db('tokens').where({ id: row.id }).del();
  return res.json({ message: 'Password updated successfully' });
};
