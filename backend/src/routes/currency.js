const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, tryAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/currencyController');

// Allow public read for basic currency info (use tryAuth for optional personalization later)
router.get('/supported', tryAuth, asyncHandler(ctrl.listSupported));
router.get('/rates', tryAuth, asyncHandler(ctrl.getRates));
router.get('/convert', tryAuth, asyncHandler(ctrl.convert));

module.exports = router;
