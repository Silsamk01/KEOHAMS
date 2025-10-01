const db = require('../config/db');
const KYC = require('../models/kyc');

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

module.exports = { isKycApproved, requireKycApproved };
