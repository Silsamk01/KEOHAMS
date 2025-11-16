const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/platformSettingsController');

// Public endpoints (no auth required)
router.get('/public', asyncHandler(ctrl.getPublicSettings));

// Admin only endpoints
router.use(requireAuth, requireRole('ADMIN'));

router.get('/', asyncHandler(ctrl.getAllSettings));
router.get('/:key', asyncHandler(ctrl.getSetting));
router.put('/:key', asyncHandler(ctrl.updateSetting));
router.post('/batch', asyncHandler(ctrl.batchUpdateSettings));

module.exports = router;
