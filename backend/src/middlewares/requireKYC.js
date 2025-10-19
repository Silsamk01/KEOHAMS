/**
 * KYC Verification Middleware
 * Ensures user has approved KYC before accessing protected features
 */
const db = require('../config/db');
const logger = require('../utils/logger');

/**
 * Middleware to require approved KYC for accessing certain routes
 * Usage: Add this middleware to routes that require KYC verification
 */
async function requireKYC(req, res, next) {
  try {
    const userId = req.user?.sub;
    
    if (!userId) {
      return res.status(401).json({ 
        message: 'Authentication required',
        requiresKYC: false
      });
    }
    
    // Check if user has approved KYC
    const kycSubmission = await db('kyc_submissions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
    
    // No KYC submission
    if (!kycSubmission) {
      return res.status(403).json({
        message: 'KYC verification required. Please complete your KYC submission to access this feature.',
        requiresKYC: true,
        kycStatus: 'NOT_SUBMITTED',
        redirectTo: '/kyc-enhanced.html'
      });
    }
    
    // KYC pending review
    if (kycSubmission.status === 'PENDING' || kycSubmission.status === 'UNDER_REVIEW') {
      return res.status(403).json({
        message: 'Your KYC submission is under review. Please wait for admin approval.',
        requiresKYC: true,
        kycStatus: kycSubmission.status,
        submittedAt: kycSubmission.created_at
      });
    }
    
    // KYC rejected
    if (kycSubmission.status === 'REJECTED') {
      return res.status(403).json({
        message: 'Your KYC submission was rejected. Please resubmit with correct documents.',
        requiresKYC: true,
        kycStatus: 'REJECTED',
        adminRemarks: kycSubmission.admin_remarks,
        canResubmit: true,
        redirectTo: '/kyc-enhanced.html'
      });
    }
    
    // KYC approved - allow access
    if (kycSubmission.status === 'APPROVED') {
      req.kycApproved = true;
      req.kycSubmission = kycSubmission;
      return next();
    }
    
    // Unknown status - block access
    return res.status(403).json({
      message: 'KYC verification status unknown. Please contact support.',
      requiresKYC: true,
      kycStatus: kycSubmission.status
    });
    
  } catch (error) {
    logger.error({ err: error, userId: req.user?.sub }, 'Error checking KYC status');
    return res.status(500).json({
      message: 'Error verifying KYC status',
      requiresKYC: false
    });
  }
}

/**
 * Optional KYC check - warns but doesn't block
 * Returns KYC status in response headers
 */
async function optionalKYC(req, res, next) {
  try {
    const userId = req.user?.sub;
    
    if (!userId) {
      return next();
    }
    
    const kycSubmission = await db('kyc_submissions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .first();
    
    if (!kycSubmission || kycSubmission.status !== 'APPROVED') {
      res.setHeader('X-KYC-Required', 'true');
      res.setHeader('X-KYC-Status', kycSubmission?.status || 'NOT_SUBMITTED');
    }
    
    req.kycApproved = kycSubmission?.status === 'APPROVED';
    req.kycSubmission = kycSubmission;
    
    next();
  } catch (error) {
    logger.error({ err: error }, 'Error in optional KYC check');
    next();
  }
}

module.exports = {
  requireKYC,
  optionalKYC
};
