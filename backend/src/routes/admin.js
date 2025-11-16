const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/adminController');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/stats', asyncHandler(ctrl.stats));
router.get('/users', asyncHandler(ctrl.listUsers));
router.patch('/users/:id', asyncHandler(ctrl.updateUser));
router.delete('/users/:id', asyncHandler(ctrl.deleteUser));
router.post('/users/:id/revoke-tokens', asyncHandler(ctrl.revokeUserTokens));

// profile
router.get('/profile', asyncHandler(ctrl.getProfile));
router.patch('/profile', asyncHandler(ctrl.updateProfile));
router.post('/profile/change-password', asyncHandler(ctrl.changePassword));
router.post('/profile/2fa/setup', asyncHandler(ctrl.twofaSetup));
router.post('/profile/2fa/enable', asyncHandler(ctrl.twofaEnable));
router.post('/profile/2fa/disable', asyncHandler(ctrl.twofaDisable));

// pending registrations
router.get('/pending-registrations', asyncHandler(ctrl.listPendingRegs));
router.post('/pending-registrations/:id/resend', asyncHandler(ctrl.resendPendingReg));
router.delete('/pending-registrations/:id', asyncHandler(ctrl.deletePendingReg));
router.post('/pending-registrations/:id/force-create', asyncHandler(ctrl.forceCreateFromPending));

// affiliate management
router.get('/affiliate/stats', asyncHandler(ctrl.getAffiliateStats));
router.get('/affiliate/list', asyncHandler(ctrl.listAffiliates));
router.get('/affiliate/:id/details', asyncHandler(ctrl.getAffiliateDetails));
router.patch('/affiliate/:id/status', asyncHandler(ctrl.updateAffiliateStatus));

// affiliate sales management
router.get('/affiliate/sales/pending', asyncHandler(ctrl.getPendingSales));
router.get('/affiliate/sales/:id', asyncHandler(ctrl.getSaleDetails));
router.post('/affiliate/sales/:id/verify', asyncHandler(ctrl.verifySale));
router.post('/affiliate/sales/create', asyncHandler(ctrl.createAffiliateSale)); // Admin manually create sale

// affiliate notifications
router.post('/affiliate/notify', asyncHandler(ctrl.notifyAffiliates)); // Send notifications to affiliates

// commission management
router.get('/affiliate/commissions/unpaid', asyncHandler(ctrl.getUnpaidCommissions));
router.post('/affiliate/commissions/release', asyncHandler(ctrl.releaseCommissions));

// commission settings
router.get('/affiliate/settings/commission', asyncHandler(ctrl.getCommissionSettings));
router.put('/affiliate/settings/commission', asyncHandler(ctrl.updateCommissionSettings));

// commission recalculation (destructive operation - use with caution)
router.post('/affiliate/recalculate-commissions', asyncHandler(ctrl.recalculateAllCommissions));

// withdrawal management
router.get('/affiliate/withdrawals/pending', asyncHandler(ctrl.getPendingWithdrawals));
router.get('/affiliate/withdrawals', asyncHandler(ctrl.listWithdrawals));
router.get('/affiliate/withdrawals/:id', asyncHandler(ctrl.getWithdrawalDetails));
router.post('/affiliate/withdrawals/:id/process', asyncHandler(ctrl.processWithdrawal));
router.get('/affiliate/withdrawals/stats', asyncHandler(ctrl.getWithdrawalStats));

// logs management
const logsCtrl = require('../controllers/logsController');
router.get('/logs', asyncHandler(logsCtrl.getLogs));
router.get('/logs/download', asyncHandler(logsCtrl.downloadLogs));
router.post('/logs/clear', asyncHandler(logsCtrl.clearOldLogs));

module.exports = router;