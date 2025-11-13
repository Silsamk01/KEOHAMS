/**
 * Unified Authentication & Authorization Middleware
 * Consolidates auth, KYC, and verification tier checks
 * 
 * Usage Examples:
 *   router.post('/route', requireAuth(), requireKYC(), handler)
 *   router.post('/route', requireAuth({ kyc: true, tier: 2 }), handler)
 *   router.get('/route', optionalAuth({ attachKYC: true }), handler)
 */

const db = require('../config/db');
const VerificationState = require('../models/verificationState');
const logger = require('../utils/logger');

// Status tier mapping for verification levels
const statusRank = {
  UNVERIFIED: 0,
  REJECTED: 0,
  BASIC_PENDING: 1,
  BASIC_VERIFIED: 2,
  KYC_PENDING: 3,
  KYC_VERIFIED: 4,
  LOCKED: -1
};

/**
 * Unified authentication middleware with optional KYC and tier checks
 * @param {Object} options - Configuration options
 * @param {boolean} options.kyc - Require approved KYC (default: false)
 * @param {number} options.tier - Require minimum verification tier (default: null)
 * @param {boolean} options.admin - Require admin role (default: false)
 * @param {string} options.role - Require specific role (default: null)
 * @returns {Function} Express middleware
 */
function requireAuth(options = {}) {
  const { 
    kyc = false, 
    tier = null, 
    admin = false, 
    role = null 
  } = options;

  return async (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.user.sub) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const userId = req.user.sub;

      // Check role if required
      if (admin && req.user.role !== 'ADMIN') {
        return res.status(403).json({ 
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      }

      if (role && req.user.role !== role) {
        return res.status(403).json({ 
          message: `Role '${role}' required`,
          code: 'ROLE_REQUIRED'
        });
      }

      // Check verification tier if required
      if (tier !== null) {
        const verificationState = await VerificationState.ensureRow(userId);
        
        if (verificationState.status === 'LOCKED') {
          return res.status(423).json({ 
            message: 'Account locked. Please contact support.',
            code: 'ACCOUNT_LOCKED'
          });
        }

        const userTier = statusRank[verificationState.status] ?? 0;
        if (userTier < tier) {
          return res.status(403).json({
            message: 'Insufficient verification level',
            code: 'VERIFICATION_REQUIRED',
            currentStatus: verificationState.status,
            requiredTier: tier
          });
        }

        req.verificationState = verificationState;
      }

      // Check KYC if required
      if (kyc) {
        const kycSubmission = await db('kyc_submissions')
          .where({ user_id: userId })
          .orderBy('created_at', 'desc')
          .first();

        if (!kycSubmission) {
          return res.status(403).json({
            message: 'KYC verification required. Please complete your KYC submission.',
            code: 'KYC_NOT_SUBMITTED',
            kycStatus: 'NOT_SUBMITTED',
            redirectTo: '/kyc-enhanced'
          });
        }

        if (kycSubmission.status === 'PENDING' || kycSubmission.status === 'UNDER_REVIEW') {
          return res.status(403).json({
            message: 'Your KYC submission is under review. Please wait for approval.',
            code: 'KYC_PENDING',
            kycStatus: kycSubmission.status,
            submittedAt: kycSubmission.created_at
          });
        }

        if (kycSubmission.status === 'REJECTED') {
          return res.status(403).json({
            message: 'Your KYC was rejected. Please resubmit with correct documents.',
            code: 'KYC_REJECTED',
            kycStatus: 'REJECTED',
            adminRemarks: kycSubmission.admin_remarks,
            redirectTo: '/kyc-enhanced'
          });
        }

        if (kycSubmission.status !== 'APPROVED') {
          return res.status(403).json({
            message: 'KYC verification status unknown. Please contact support.',
            code: 'KYC_UNKNOWN',
            kycStatus: kycSubmission.status
          });
        }

        req.kycApproved = true;
        req.kycSubmission = kycSubmission;
      }

      next();
    } catch (error) {
      logger.error({ err: error, userId: req.user?.sub }, 'Unified auth middleware error');
      return res.status(500).json({
        message: 'Authentication check failed',
        code: 'AUTH_ERROR'
      });
    }
  };
}

/**
 * Optional authentication - attaches user/KYC data if present but doesn't block
 * @param {Object} options - Configuration options
 * @param {boolean} options.attachKYC - Attach KYC status to req (default: false)
 * @param {boolean} options.attachVerification - Attach verification state (default: false)
 * @returns {Function} Express middleware
 */
function optionalAuth(options = {}) {
  const { attachKYC = false, attachVerification = false } = options;

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.sub) {
        return next();
      }

      const userId = req.user.sub;

      // Attach KYC status if requested
      if (attachKYC) {
        const kycSubmission = await db('kyc_submissions')
          .where({ user_id: userId })
          .orderBy('created_at', 'desc')
          .first();

        req.kycApproved = kycSubmission?.status === 'APPROVED';
        req.kycSubmission = kycSubmission;

        // Set response headers
        if (!req.kycApproved) {
          res.setHeader('X-KYC-Required', 'true');
          res.setHeader('X-KYC-Status', kycSubmission?.status || 'NOT_SUBMITTED');
        }
      }

      // Attach verification state if requested
      if (attachVerification) {
        const verificationState = await VerificationState.ensureRow(userId);
        req.verificationState = verificationState;
        res.setHeader('X-Verification-Status', verificationState.status);
      }

      next();
    } catch (error) {
      logger.error({ err: error }, 'Optional auth middleware error');
      next(); // Don't block on error for optional auth
    }
  };
}

/**
 * Helper to create middleware chain
 * @param {Array} middlewares - Array of middleware functions
 * @returns {Function} Combined middleware
 */
function chain(...middlewares) {
  return (req, res, next) => {
    const executeMiddleware = (index) => {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index];
      middleware(req, res, (err) => {
        if (err) return next(err);
        executeMiddleware(index + 1);
      });
    };

    executeMiddleware(0);
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  chain,
  statusRank
};
