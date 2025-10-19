const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/verificationController');

// User routes
router.use(requireAuth);
router.get('/status', asyncHandler(ctrl.getStatus));
router.post('/basic/trigger', asyncHandler(ctrl.triggerBasicCheck));

module.exports = router;
