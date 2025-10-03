const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/chatController');

// User routes
router.post('/threads', requireAuth, asyncHandler(ctrl.startThread));
router.get('/threads/mine', requireAuth, asyncHandler(ctrl.listThreadsMine));
router.get('/threads/:id/messages', requireAuth, asyncHandler(ctrl.listMessages));
router.post('/threads/:id/messages', requireAuth, asyncHandler(ctrl.postMessage));
router.get('/unread-count', requireAuth, asyncHandler(ctrl.unreadCount));
router.post('/threads/:id/mark-seen', requireAuth, asyncHandler(ctrl.markSeen));
// hide message/thread (soft delete for viewer)
router.post('/messages/:id/hide', requireAuth, asyncHandler(ctrl.hideMessage));
router.post('/threads/:id/hide', requireAuth, asyncHandler(ctrl.hideThread));

// Admin routes
router.get('/admin/threads', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminListThreads));
router.delete('/admin/threads/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminDeleteThread));

module.exports = router;
