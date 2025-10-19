/**
 * Enhanced KYC Routes
 */
const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/enhancedKYCController');

// Ensure KYC uploads directory exists
const kycUploadsDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(kycUploadsDir)) {
  fs.mkdirSync(kycUploadsDir, { recursive: true });
}

// Configure multer for KYC document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycUploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.sub || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const fieldName = file.fieldname;
    cb(null, `${userId}_${fieldName}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed: JPG, PNG, PDF`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
    files: 3 // Max 3 files
  }
});

// Define upload fields
const uploadFields = upload.fields([
  { name: 'id_document', maxCount: 1 },
  { name: 'live_photo', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 }
]);

// ============ USER ROUTES ============

/**
 * POST /api/kyc/enhanced/upload
 * Upload KYC documents (Government ID + Live Photo + Address Proof)
 */
router.post(
  '/upload',
  requireAuth,
  uploadFields,
  asyncHandler(ctrl.uploadKYCDocuments)
);

/**
 * GET /api/kyc/enhanced/status
 * Get current user's KYC submission status
 */
router.get(
  '/status',
  requireAuth,
  asyncHandler(ctrl.getKYCStatus)
);

// ============ ADMIN ROUTES ============

/**
 * GET /api/kyc/enhanced/admin/list
 * List all KYC submissions (admin only)
 * Query params: status, page, pageSize, search
 */
router.get(
  '/admin/list',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(ctrl.adminListKYC)
);

/**
 * GET /api/kyc/enhanced/admin/:id
 * Get detailed KYC submission with OCR, face match, audit log (admin only)
 */
router.get(
  '/admin/:id',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(ctrl.adminGetKYCDetail)
);

/**
 * POST /api/kyc/enhanced/admin/:id/review
 * Approve or reject KYC submission (admin only)
 * Body: { action: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMIT', remarks: string }
 */
router.post(
  '/admin/:id/review',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(ctrl.adminReviewKYC)
);

/**
 * GET /api/kyc/enhanced/admin/:id/document/:docType
 * View KYC document (admin only)
 * docType: 'id' | 'selfie' | 'address'
 */
router.get(
  '/admin/:id/document/:docType',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(ctrl.adminViewDocument)
);

module.exports = router;
