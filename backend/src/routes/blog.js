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
router.use('/admin', requireAuth, requireRole('ADMIN'));
router.get('/admin', asyncHandler(ctrl.adminList));
router.post('/admin', asyncHandler(ctrl.create));
router.patch('/admin/:id', asyncHandler(ctrl.update));
router.post('/admin/:id/publish', asyncHandler(ctrl.publish));
router.post('/admin/:id/unpublish', asyncHandler(ctrl.unpublish));
router.delete('/admin/:id', asyncHandler(ctrl.remove));

// Admin sync control endpoints
router.get('/admin/sync/stats', asyncHandler(syncCtrl.getSyncStats));
router.post('/admin/sync/all', asyncHandler(syncCtrl.syncAll));
router.post('/admin/sync/:id', asyncHandler(syncCtrl.syncPost));

module.exports = router;
