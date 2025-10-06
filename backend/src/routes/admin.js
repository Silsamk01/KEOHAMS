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

router.get('/kyc', asyncHandler(ctrl.listKyc));
router.get('/kyc/:id', asyncHandler(ctrl.getKyc));
router.post('/kyc/:id/approve', asyncHandler(ctrl.approveKyc));
router.post('/kyc/:id/reject', asyncHandler(ctrl.rejectKyc));

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

module.exports = router;