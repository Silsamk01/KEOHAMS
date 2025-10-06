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
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, dob: user.dob, avatar_url: user.avatar_url, twofa_enabled: !!user.twofa_secret });
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
