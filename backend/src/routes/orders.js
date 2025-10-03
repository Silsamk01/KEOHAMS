const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const Orders = require('../models/order');

router.get('/my/summary', requireAuth, asyncHandler(async (req, res) => {
  const count = await Orders.countForUser(req.user.sub);
  res.json({ count });
}));

module.exports = router;
