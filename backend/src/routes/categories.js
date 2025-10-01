const router = require('express').Router();
const ctrl = require('../controllers/categoryController');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', asyncHandler(ctrl.list));
router.post('/', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.create));
router.put('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.remove));

module.exports = router;
