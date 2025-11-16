const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/blogController');
const syncCtrl = require('../controllers/blogSyncController');
const { requireAuth, requireRole, tryAuth } = require('../middlewares/auth');
const { requireKYC, optionalKYC } = require('../middlewares/requireKYC');

// Admin endpoints (protected by requireAuth and requireRole, bypasses KYC)
router.get('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.adminList));
router.post('/admin', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.create));
router.patch('/admin/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.update));
router.post('/admin/:id/publish', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.publish));
router.post('/admin/:id/unpublish', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.unpublish));
router.delete('/admin/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.remove));

// Admin sync control endpoints
router.get('/admin/sync/stats', requireAuth, requireRole('ADMIN'), asyncHandler(syncCtrl.getSyncStats));
router.post('/admin/sync/all', requireAuth, requireRole('ADMIN'), asyncHandler(syncCtrl.syncAll));
router.post('/admin/sync/:id', requireAuth, requireRole('ADMIN'), asyncHandler(syncCtrl.syncPost));

// Regular user endpoints (optional auth for listing, required for details)
router.get('/', tryAuth, optionalKYC, asyncHandler(ctrl.list)); // Allow public listing
router.get('/slug/:slug', requireAuth, requireKYC, asyncHandler(ctrl.getBySlug)); // Require auth for details

module.exports = router;
