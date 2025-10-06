const db = require('../config/db');
const KYC = require('../models/kyc');
const VerificationState = require('../models/verificationState');

async function isKycApproved(userId) {
  const row = await db(KYC.TABLE).where({ user_id: userId }).orderBy('submitted_at','desc').first();
  return !!row && row.status === 'APPROVED';
}

function requireKycApproved() {
  return async (req, res, next) => {
    try {
      const ok = await isKycApproved(req.user.sub);
      if (!ok) return res.status(403).json({ message: 'KYC not approved' });
      next();
    } catch (e) { next(e); }
  };
}

// Strict site-wide KYC gate: require overall verification state to be KYC_VERIFIED
// Designed to be placed early (after auth) for protected API routes.
async function ensureKycVerified(userId) {
  // Prefer verification_state canonical table to avoid scanning submissions each time
  const row = await VerificationState.ensureRow(userId);
  return row.status === 'KYC_VERIFIED';
}

function strictKycGate() {
  return async (req, res, next) => {
    try {
      const ok = await ensureKycVerified(req.user.sub);
      if (!ok) {
        return res.status(451).json({ message: 'KYC_REQUIRED', detail: 'KYC verification required before accessing this resource.' });
      }
      next();
    } catch (e) { next(e); }
  };
}

module.exports = { isKycApproved, requireKycApproved, strictKycGate, ensureKycVerified };
