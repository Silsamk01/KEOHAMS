const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const Users = require('../models/user');
const { sign } = require('../utils/jwt');
const { sendMail } = require('../utils/email');

// simple tokens table for email verification
async function ensureTokensTable() {
  const exists = await db.schema.hasTable('tokens');
  if (!exists) {
    await db.schema.createTable('tokens', (t) => {
      t.increments('id').primary();
      t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('type').notNullable(); // 'verify-email'
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
  const { email, password, captchaToken, captchaAnswer } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  try { verifyCaptcha(captchaToken, captchaAnswer); } catch (e) { return res.status(400).json({ message: e.message }); }
  const user = await Users.findByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  // Optionally enforce email verification before login
  // if (!user.email_verified) return res.status(403).json({ message: 'Please verify your email' });

  const token = sign({ sub: user.id, role: user.role });
  return res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
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
    email_verified: !!user.email_verified
  });
};
