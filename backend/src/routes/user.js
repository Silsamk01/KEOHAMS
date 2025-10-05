const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/userController');
const { upload } = require('../middlewares/upload');

router.use(requireAuth);
router.get('/profile', asyncHandler(ctrl.getProfile));
router.patch('/profile', asyncHandler(ctrl.updateProfile));
router.post('/profile/change-password', asyncHandler(ctrl.changePassword));
router.post('/profile/2fa/setup', asyncHandler(ctrl.twofaSetup));
router.post('/profile/2fa/enable', asyncHandler(ctrl.twofaEnable));
router.post('/profile/2fa/disable', asyncHandler(ctrl.twofaDisable));
router.post('/profile/2fa/recovery/regenerate', asyncHandler(ctrl.regenerateRecoveryCodes));
router.get('/profile/2fa/recovery', asyncHandler(ctrl.getRecoveryCodes));
router.post('/profile/avatar', upload.single('avatar'), asyncHandler(ctrl.uploadAvatar));

module.exports = router;