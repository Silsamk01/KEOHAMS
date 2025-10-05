const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/contactController');

// Admin CRUD-ish (read-only + mark read)
router.get('/', requireAuth, requireRole('admin'), asyncHandler(ctrl.list));
router.get('/:id', requireAuth, requireRole('admin'), asyncHandler(ctrl.show));
router.post('/:id/read', requireAuth, requireRole('admin'), asyncHandler(ctrl.markRead));

module.exports = router;
