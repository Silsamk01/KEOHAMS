const router = require('express').Router();
const authController = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const { createCaptcha } = require('../utils/captcha');

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));
router.get('/verify-email', asyncHandler(authController.verifyEmail));
router.get('/me', requireAuth, asyncHandler(authController.me));

// Simple custom captcha endpoint
router.get('/captcha', (req, res) => {
	const { token, question, expiresAt, ttl } = createCaptcha();
	res.set('Cache-Control', 'no-store');
	res.json({ token, question, expiresAt, ttl });
});

module.exports = router;
