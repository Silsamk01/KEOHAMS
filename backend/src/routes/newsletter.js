const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/newsletterController');
const { requireAuth, requireRole } = require('../middlewares/auth');

// Public endpoints
router.post('/subscribe', asyncHandler(ctrl.subscribe));
router.get('/unsubscribe', asyncHandler(ctrl.unsubscribe));

// Admin endpoints
router.get('/admin/subscribers', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.listSubscribers));
router.get('/admin/stats', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.getStats));
router.delete('/admin/subscribers/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.deleteSubscriber));

router.get('/admin/campaigns', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.listCampaigns));
router.post('/admin/campaigns', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.createCampaign));
router.post('/admin/campaigns/:id/send', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.sendCampaign));
router.delete('/admin/campaigns/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.deleteCampaign));

module.exports = router;
