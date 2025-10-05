const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ReadEvents = require('../models/notificationReadEvent');

router.get('/', requireAuth, requireRole('admin'), asyncHandler(async (req, res)=>{
  const limit = Number(req.query.limit || 30);
  const data = await ReadEvents.recent({ limit });
  res.json({ data });
}));

module.exports = router;