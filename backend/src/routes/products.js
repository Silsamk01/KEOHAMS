const router = require('express').Router();
const ctrl = require('../controllers/productController');
const asyncHandler = require('../utils/asyncHandler');
const { upload } = require('../middlewares/upload');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', asyncHandler(ctrl.list));
router.get('/:id', asyncHandler(ctrl.get));
router.post('/', requireAuth, requireRole('ADMIN'), upload.fields([{ name: 'images' }, { name: 'videos' }]), asyncHandler(ctrl.create));
router.put('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.update));
router.delete('/:id', requireAuth, requireRole('ADMIN'), asyncHandler(ctrl.remove));

module.exports = router;
