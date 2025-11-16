const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/activityController');

// User's own activity history
router.get('/my-activities', requireAuth, asyncHandler(ctrl.getMyActivities));

// Admin only endpoints
router.get('/stats', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.getStats));
router.get('/', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.getRecentActivities));

module.exports = router;
