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

// Revoke all active tokens by bumping token_version
exports.revokeUserTokens = async (req, res) => {
  const { id } = req.params;
  const user = await Users.findById(id);
  if (!user) return res.status(404).json({ message: 'Not found' });
  const nextVersion = (user.token_version || 1) + 1;
  await Users.update(user.id, { token_version: nextVersion });
  await AdminAudit.log({ admin_id: req.user.sub, target_user_id: user.id, action: 'TOKEN_REVOKE', metadata: { prev: user.token_version, next: nextVersion } }).catch(()=>{});
  // TODO: emit forceLogout via sockets if implemented
  res.json({ message: 'Revoked', token_version: nextVersion });
};
