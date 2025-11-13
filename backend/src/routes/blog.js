const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/blogController');
const syncCtrl = require('../controllers/blogSyncController');
const { requireAuth, requireRole, tryAuth } = require('../middlewares/auth');

// Auth required for authenticated blog content (private portal)
router.use(requireAuth);
router.get('/', asyncHandler(ctrl.list));
router.get('/slug/:slug', asyncHandler(ctrl.getBySlug));

// Admin endpoints
router.get('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminList));
router.post('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.create));
router.patch('/admin/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.update));
router.post('/admin/:id/publish', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.publish));
router.post('/admin/:id/unpublish', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.unpublish));
router.delete('/admin/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.remove));

// Admin sync control endpoints
router.get('/admin/sync/stats', asyncHandler(syncCtrl.getSyncStats));
router.post('/admin/sync/all', asyncHandler(syncCtrl.syncAll));
router.post('/admin/sync/:id', asyncHandler(syncCtrl.syncPost));

module.exports = router;
