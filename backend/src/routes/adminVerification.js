const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/verificationController');

router.use(requireAuth, requireRole('ADMIN'));

router.get('/states', asyncHandler(ctrl.adminListStates));
router.get('/states/:user_id', asyncHandler(ctrl.adminGetState));
router.post('/kyc/:submission_id/approve', asyncHandler(ctrl.adminApproveKyc));
router.post('/kyc/:submission_id/reject', asyncHandler(ctrl.adminRejectKyc));
router.post('/score/:user_id/adjust', asyncHandler(ctrl.adminAdjustScore));
router.post('/lock/:user_id', asyncHandler(ctrl.adminLock));
router.post('/unlock/:user_id', asyncHandler(ctrl.adminUnlock));
router.get('/risk-events/:user_id', asyncHandler(ctrl.adminRiskEvents));
router.get('/state-events/:user_id', asyncHandler(ctrl.adminStateEvents));

module.exports = router;
