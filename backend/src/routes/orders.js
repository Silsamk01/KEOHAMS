const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const { requireVerificationTier } = require('../middlewares/requireVerification');
const Orders = require('../models/order');

router.get('/my/summary', requireAuth, asyncHandler(async (req, res) => {
  const count = await Orders.countForUser(req.user.sub);
  res.json({ count });
}));

module.exports = router;
// Example protected action (future order creation) requiring BASIC_VERIFIED tier (rank >=2)
router.post('/create', requireAuth, requireVerificationTier(2), asyncHandler(async (req, res) => {
  // Placeholder - real implementation would validate cart & pricing
  res.status(501).json({ message: 'Order creation not implemented yet' });
}));
