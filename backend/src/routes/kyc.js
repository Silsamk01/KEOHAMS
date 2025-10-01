const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middlewares/auth');
const { requireKycApproved } = require('../middlewares/kyc');
const { kycUpload } = require('../middlewares/upload');
const KYC = require('../models/kyc');
const db = require('../config/db');

router.use(requireAuth);

// Get latest KYC submission for current user
router.get('/me', asyncHandler(async (req, res) => {
  const row = await db(KYC.TABLE).where({ user_id: req.user.sub }).orderBy('submitted_at','desc').first();
  res.json(row || null);
}));

// Submit KYC files: portrait image, selfie video, id_front, id_back
router.post('/submit', kycUpload.fields([
  { name: 'portrait', maxCount: 1 },
  { name: 'selfie_video', maxCount: 1 },
  { name: 'id_front', maxCount: 1 },
  { name: 'id_back', maxCount: 1 }
]), asyncHandler(async (req, res) => {
  const type = req.body.type || 'ID';
  const notes = req.body.notes || null;
  const files = {};
  const map = {
    portrait: req.files?.portrait?.[0],
    selfie_video: req.files?.selfie_video?.[0],
    id_front: req.files?.id_front?.[0],
    id_back: req.files?.id_back?.[0]
  };
  for (const [k, v] of Object.entries(map)) {
    if (v) files[k] = `/uploads/${v.filename}`;
  }
  if (!files.portrait || !files.selfie_video || !files.id_front) {
    return res.status(400).json({ message: 'portrait, selfie_video, and id_front are required' });
  }
  const payload = { user_id: req.user.sub, status: 'PENDING', type, files: JSON.stringify(files), notes };
  await KYC.create(payload);
  res.status(201).json({ message: 'KYC submitted' });
}));

// Example of a KYC-gated endpoint users can call from dashboard
router.get('/gated/ping', requireKycApproved(), asyncHandler(async (req, res) => {
  res.json({ ok: true, message: 'Access granted. Your KYC is approved.' });
}));

module.exports = router;
