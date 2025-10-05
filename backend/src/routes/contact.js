const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { tryAuth } = require('../middlewares/auth');
const ctrl = require('../controllers/contactController');

// Public submit (user optional)
router.post('/', tryAuth, asyncHandler(ctrl.submit));

module.exports = router;
