const VerificationState = require('../models/verificationState');
const RiskEvent = require('../models/riskEvent');
const risk = require('../services/riskEngine');
const db = require('../config/db');
const VerificationStateEvent = require('../models/verificationStateEvent');

// Helper to advance verification state based on profile completeness
async function maybePromoteToBasic(user_id) {
  const state = await VerificationState.ensureRow(user_id);
  const user = await db('users').select('phone','address','email_verified','dob').where({ id: user_id }).first();
  // Promote UNVERIFIED/REJECTED -> BASIC_PENDING if minimal profile supplied
  if (['UNVERIFIED','REJECTED'].includes(state.status)) {
    if (user && user.phone && user.address && user.email_verified) {
      const prev = state.status;
      const updated = await VerificationState.updateByUser(user_id, { status: 'BASIC_PENDING', updated_at: db.fn.now() });
      await VerificationStateEvent.log({ user_id, from_status: prev, to_status: 'BASIC_PENDING', metadata: { auto: true } });
      return updated;
    }
    return state;
  }
  // Auto escalate BASIC_PENDING -> BASIC_VERIFIED once DOB also present
  if (state.status === 'BASIC_PENDING') {
    if (user && user.phone && user.address && user.email_verified && user.dob) {
      const prev = state.status;
      const updated = await VerificationState.updateByUser(user_id, { status: 'BASIC_VERIFIED', basic_verified_at: db.fn.now(), updated_at: db.fn.now() });
      await VerificationStateEvent.log({ user_id, from_status: prev, to_status: 'BASIC_VERIFIED', metadata: { auto: true } });
      return updated;
    }
  }
  return state;
}

exports.getStatus = async (req, res) => {
  const row = await VerificationState.ensureRow(req.user.sub);
  res.json({
    status: row.status,
    risk_score: row.risk_score,
    risk_level: row.risk_level,
    basic_verified_at: row.basic_verified_at,
    manual_lock: !!row.manual_lock
  });
};

exports.triggerBasicCheck = async (req, res) => {
  const updated = await maybePromoteToBasic(req.user.sub);
  res.json({ status: updated.status });
};

// Admin endpoints
exports.adminListStates = async (req, res) => {
  const page = Number(req.query.page || 1); const pageSize = Math.min(Number(req.query.pageSize)||20,100);
  const base = db(VerificationState.TABLE).select('*').orderBy('id','desc');
  const data = await base.clone().offset((page-1)*pageSize).limit(pageSize);
  const [{ count }] = await db(VerificationState.TABLE).count({ count: '*' });
  res.json({ data, total: Number(count||0) });
};

exports.adminGetState = async (req, res) => {
  const user_id = Number(req.params.user_id);
  const row = await VerificationState.findByUser(user_id);
  if (!row) return res.status(404).json({ message: 'Not found' });
  res.json({ state: row });
};

exports.adminAdjustScore = async (req, res) => {
  const user_id = Number(req.params.user_id);
  const delta = Number(req.body.delta || 0);
  if (!delta) return res.status(400).json({ message: 'delta required' });
  const result = await risk.adjustScore(user_id, delta, 'ADMIN_MANUAL_ADJUST', { reason: req.body.reason || null });
  res.json(result);
};

exports.adminLock = async (req, res) => {
  const user_id = Number(req.params.user_id);
  await db.transaction(async trx => {
    const prevState = await trx(VerificationState.TABLE).where({ user_id }).first();
    await trx(VerificationState.TABLE).where({ user_id }).update({ status: 'LOCKED', manual_lock: true, lock_reason: req.body.reason || null, locked_at: trx.fn.now(), updated_at: trx.fn.now() });
    await VerificationStateEvent.log({ user_id, from_status: prevState.status, to_status: 'LOCKED', actor_id: req.user.sub, metadata: { reason: req.body.reason || null } }, trx);
    await risk.adjustScore(user_id, +100, 'ADMIN_LOCK', { reason: req.body.reason || null }, trx);
  });
  res.json({ message: 'User locked' });
};

exports.adminUnlock = async (req, res) => {
  const user_id = Number(req.params.user_id);
  let newStatus;
  await db.transaction(async trx => {
    const state = await trx(VerificationState.TABLE).where({ user_id }).first();
    if (!state) throw Object.assign(new Error('Not found'), { status: 404 });
    newStatus = state.basic_verified_at ? 'BASIC_VERIFIED' : 'UNVERIFIED';
    await trx(VerificationState.TABLE).where({ user_id }).update({ status: newStatus, manual_lock: false, lock_reason: null, locked_at: null, updated_at: trx.fn.now() });
    await VerificationStateEvent.log({ user_id, from_status: state.status, to_status: newStatus, actor_id: req.user.sub, metadata: {} }, trx);
    await risk.adjustScore(user_id, -30, 'ADMIN_UNLOCK', {}, trx);
  });
  res.json({ message: 'User unlocked', status: newStatus });
};

exports.adminRiskEvents = async (req, res) => {
  const user_id = Number(req.params.user_id);
  const page = Number(req.query.page||1); const pageSize = Math.min(Number(req.query.pageSize)||50,200);
  const out = await RiskEvent.listForUser(user_id, { page, pageSize });
  res.json(out);
};

// List verification state events
exports.adminStateEvents = async (req, res) => {
  const user_id = Number(req.params.user_id);
  const page = Number(req.query.page||1); const pageSize = Math.min(Number(req.query.pageSize)||50,200);
  const VerificationStateEvent = require('../models/verificationStateEvent');
  const out = await VerificationStateEvent.listForUser(user_id, { page, pageSize });
  res.json(out);
};
