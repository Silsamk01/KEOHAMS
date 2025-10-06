const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/blogController');
const { requireAuth, requireRole, tryAuth } = require('../middlewares/auth');

// Auth required for all blog content now
router.use(requireAuth);
router.get('/', asyncHandler(ctrl.list));
router.get('/slug/:slug', asyncHandler(ctrl.getBySlug));

// Admin endpoints
router.use('/admin', requireAuth, requireRole('ADMIN'));
router.get('/admin', asyncHandler(ctrl.adminList));
router.post('/admin', asyncHandler(ctrl.create));
router.patch('/admin/:id', asyncHandler(ctrl.update));
router.post('/admin/:id/publish', asyncHandler(ctrl.publish));
router.post('/admin/:id/unpublish', asyncHandler(ctrl.unpublish));
router.delete('/admin/:id', asyncHandler(ctrl.remove));

module.exports = router;
