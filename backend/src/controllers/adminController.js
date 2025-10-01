const db = require('../config/db');
const Users = require('../models/user');
const KYC = require('../models/kyc');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { sendMail } = require('../utils/email');

exports.stats = async (req, res) => {
  const [u] = await db('users').count({ c: '*' });
  const [p] = await db('products').count({ c: '*' }).catch(() => [{ c: 0 }]);
  const [c] = await db('categories').count({ c: '*' }).catch(() => [{ c: 0 }]);
  const [k] = await db('kyc_submissions').where({ status: 'PENDING' }).count({ c: '*' }).catch(() => [{ c: 0 }]);
  res.json({ users: Number(u.c||0), products: Number(p.c||0), categories: Number(c.c||0), kyc_pending: Number(k.c||0) });
};

exports.listUsers = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const q = String(req.query.q || '').trim();
  const base = db(Users.TABLE).select('id','name','email','role','email_verified','created_at');
  if (q) base.where((b)=> b.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`));
  base.orderBy('id','desc');
  const offset = (page - 1) * pageSize;
  const data = await base.clone().offset(offset).limit(pageSize);
  const [{ count }] = await db(Users.TABLE).modify((qb)=>{ if (q) qb.whereILike('name', `%${q}%`).orWhereILike('email', `%${q}%`); }).count({ count: '*' });
  res.json({ data, total: Number(count || 0) });
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, email_verified } = req.body;
  const changes = {};
  if (role) {
    if (!['ADMIN','CUSTOMER'].includes(role)) return res.status(400).json({ message: 'Invalid role' });
    changes.role = role;
  }
  if (typeof email_verified === 'boolean') changes.email_verified = email_verified;
  if (!Object.keys(changes).length) return res.status(400).json({ message: 'No changes' });
  await db(Users.TABLE).where({ id }).update(changes);
  const user = await Users.findById(id);
  res.json({ user });
};

exports.listKyc = async (req, res) => {
  const page = Number(req.query.page || 1);
  const pageSize = Number(req.query.pageSize || 20);
  const status = req.query.status;
  const { data, total } = await KYC.list({ status, page, pageSize });
  res.json({ data, total });
};

exports.getKyc = async (req, res) => {
  const row = await KYC.findById(req.params.id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json(row);
};

exports.approveKyc = async (req, res) => {
  const id = Number(req.params.id);
  const reviewer_id = req.user.sub;
  await KYC.update(id, { status: 'APPROVED', reviewer_id, review_notes: req.body.review_notes || null, reviewed_at: db.fn.now() });
  res.json({ message: 'KYC approved' });
};

exports.rejectKyc = async (req, res) => {
  const id = Number(req.params.id);
  const reviewer_id = req.user.sub;
  await KYC.update(id, { status: 'REJECTED', reviewer_id, review_notes: req.body.review_notes || null, reviewed_at: db.fn.now() });
  res.json({ message: 'KYC rejected' });
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
  res.json({ message: 'Verification email resent' });
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
    role: 'CUSTOMER',
    email_verified: 1
  });
  await db('pending_registrations').where({ id }).del();
  res.json({ message: 'User created', user_id: userId });
};
