const db = require('../config/db');
const VerificationState = require('../models/verificationState');
const RiskEvent = require('../models/riskEvent');

// Basic mapping from score -> level
function levelFor(score) {
  if (score >= 700) return 'CRITICAL';
  if (score >= 400) return 'HIGH';
  if (score >= 200) return 'MEDIUM';
  return 'LOW';
}

async function adjustScore(user_id, delta, event_type, metadata, trx) {
  // Ensure verification state row (ensureRow always uses base db; acceptable for now)
  const state = await VerificationState.ensureRow(user_id);
  const newScore = Math.max(0, (state.risk_score || 0) + delta);
  const newLevel = levelFor(newScore);
  if (trx) {
    await trx(VerificationState.TABLE).where({ user_id }).update({ risk_score: newScore, risk_level: newLevel, updated_at: trx.fn.now() });
    await trx(RiskEvent.TABLE).insert({
      user_id,
      event_type,
      delta,
      resulting_score: newScore,
      resulting_level: newLevel,
      metadata: metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null,
      created_at: trx.fn.now()
    });
  } else {
    await VerificationState.updateByUser(user_id, { risk_score: newScore, risk_level: newLevel });
    await RiskEvent.log({ user_id, event_type, delta, resulting_score: newScore, resulting_level: newLevel, metadata });
  }
  return { risk_score: newScore, risk_level: newLevel };
}

async function recompute(user_id, trx) {
  // For now simple: just reads current score and clamps level
  const state = await VerificationState.ensureRow(user_id);
  const level = levelFor(state.risk_score || 0);
  if (level !== state.risk_level) {
    if (trx) {
      await trx(VerificationState.TABLE).where({ user_id }).update({ risk_level: level, updated_at: trx.fn.now() });
    } else {
      await VerificationState.updateByUser(user_id, { risk_level: level });
    }
  }
  return { risk_score: state.risk_score || 0, risk_level: level };
}

module.exports = { adjustScore, recompute, levelFor };
