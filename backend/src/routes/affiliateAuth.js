const express = require('express');
const router = express.Router();
const affiliateAuthController = require('../controllers/affiliateAuthController');
const { requireAffiliateAuth } = require('../middlewares/affiliateAuth');

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`[AffiliateAuth] ${req.method} ${req.path}`, {
    body: req.method === 'POST' ? { ...req.body, password: req.body?.password ? '[HIDDEN]' : undefined } : undefined,
    headers: req.headers.authorization ? 'Authorization present' : 'No authorization'
  });
  next();
});

// Test endpoint to verify route is working
router.get('/test', (req, res) => {
  res.json({ message: 'Affiliate auth routes are working', timestamp: new Date().toISOString() });
});

// Public routes
router.post('/register', (req, res, next) => {
  console.log('[REGISTER ROUTE] Route handler called');
  affiliateAuthController.register(req, res).catch(next);
});
router.post('/login', affiliateAuthController.login);
router.get('/verify-email', affiliateAuthController.verifyEmail);

// Protected routes
router.get('/me', requireAffiliateAuth, affiliateAuthController.me);

module.exports = router;

