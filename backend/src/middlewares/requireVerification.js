const VerificationState = require('../models/verificationState');

// Map a status into a numeric tier for simple comparison
// UNVERIFIED(0) < BASIC_PENDING(1) < BASIC_VERIFIED(2) < KYC_PENDING(3) < KYC_VERIFIED(4) < LOCKED(-1)
const statusRank = {
  UNVERIFIED: 0,
  REJECTED: 0, // treat rejected same as unverified for gating (can resubmit basic)
  BASIC_PENDING: 1,
  BASIC_VERIFIED: 2,
  KYC_PENDING: 3,
  KYC_VERIFIED: 4,
  LOCKED: -1
};

function tierForStatus(status) {
  return statusRank[status] ?? 0;
}

// requireVerificationTier(min) ensures user's verification status rank >= min and not locked
function requireVerificationTier(minTier) {
  return async (req, res, next) => {
    try {
      const row = await VerificationState.ensureRow(req.user.sub);
      if (row.status === 'LOCKED') return res.status(423).json({ message: 'Account locked' });
      const tier = tierForStatus(row.status);
      if (tier < minTier) {
        return res.status(403).json({ message: 'Verification level too low', status: row.status });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireVerificationTier, tierForStatus };
