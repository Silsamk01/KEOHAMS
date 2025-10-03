const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/notificationController');

// user-facing
router.get('/mine', requireAuth, asyncHandler(ctrl.listMine));
router.get('/unread-count', requireAuth, asyncHandler(ctrl.unreadCount));
router.post('/:id/read', requireAuth, asyncHandler(ctrl.markRead));
router.post('/mark-all-read', requireAuth, asyncHandler(ctrl.markAllRead));

// admin
router.get('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminList));
router.post('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminCreate));
router.delete('/admin/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminDelete));

module.exports = router;
