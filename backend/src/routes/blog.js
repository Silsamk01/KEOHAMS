const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const ctrl = require('../controllers/blogController');
const { requireAuth, requireRole, tryAuth } = require('../middlewares/auth');

// Public endpoints
// tryAuth: a lightweight middleware to decode token if provided; otherwise continue unauthenticated
router.get('/', asyncHandler(ctrl.list));
router.get('/slug/:slug', tryAuth ? tryAuth : (req, _res, next) => next(), asyncHandler(ctrl.getBySlug));

// Admin endpoints
router.use('/admin', requireAuth, requireRole('ADMIN'));
router.get('/admin', asyncHandler(ctrl.adminList));
router.post('/admin', asyncHandler(ctrl.create));
router.patch('/admin/:id', asyncHandler(ctrl.update));
router.delete('/admin/:id', asyncHandler(ctrl.remove));

module.exports = router;
