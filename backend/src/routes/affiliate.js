const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const auth = require('../middlewares/auth');

// Public routes (no authentication required)
router.get('/referral/:code', affiliateController.getByReferralCode);

// Protected routes (authentication required)
router.use(auth.requireAuth);

// Affiliate registration
router.post('/register', affiliateController.register);

// Affiliate dashboard and stats
router.get('/dashboard/:user_id', auth.requireSelfOrAdmin, affiliateController.getDashboard);
router.get('/stats/:user_id', auth.requireSelfOrAdmin, affiliateController.getStats);

// Network management
router.get('/network/:user_id', auth.requireSelfOrAdmin, affiliateController.getNetworkTree);

// Sales management
router.post('/sales/:user_id', auth.requireSelfOrAdmin, affiliateController.recordSale);
router.get('/sales/:user_id', auth.requireSelfOrAdmin, affiliateController.getSales);

// Commission tracking
router.get('/commissions/:user_id', auth.requireSelfOrAdmin, affiliateController.getCommissions);
router.get('/commission-preview/:user_id', auth.requireSelfOrAdmin, affiliateController.getCommissionPreview);

// Profile management
router.put('/profile/:user_id', auth.requireSelfOrAdmin, affiliateController.updateProfile);

module.exports = router;