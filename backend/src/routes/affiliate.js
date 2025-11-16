const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const { requireAffiliateAuth, requireAffiliateSelfOrAdmin } = require('../middlewares/affiliateAuth');

// Public routes (no authentication required)
router.get('/referral/:code', affiliateController.getByReferralCode);

// Protected routes (affiliate authentication required)
router.use(requireAffiliateAuth);

// Affiliate dashboard and stats (uses req.affiliate.id from middleware)
router.get('/dashboard', affiliateController.getDashboard);
router.get('/stats', affiliateController.getStats);

// Network management
router.get('/network', affiliateController.getNetworkTree);

// Sales management (affiliates can only view sales, not create them manually)
// router.post('/sales', affiliateController.recordSale); // DISABLED - Sales are auto-created by system
router.get('/sales', affiliateController.getSales);

// Commission tracking
router.get('/commissions', affiliateController.getCommissions);
router.get('/commission-preview', affiliateController.getCommissionPreview);

// Profile management
router.put('/profile', affiliateController.updateProfile);

// Withdrawal management
router.post('/withdrawals', affiliateController.requestWithdrawal);
router.get('/withdrawals', affiliateController.getWithdrawals);
router.delete('/withdrawals/:withdrawal_id', affiliateController.cancelWithdrawal);

module.exports = router;