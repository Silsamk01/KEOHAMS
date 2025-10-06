const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requireRole } = require('../middlewares/auth');
const ctrl = require('../controllers/quotationController');

// User quotation endpoints
router.use(requireAuth);
router.post('/', asyncHandler(ctrl.requestQuotation));
router.get('/mine', asyncHandler(ctrl.listMine));
router.get('/mine/:id', asyncHandler(ctrl.getMine));
router.post('/mine/:id/pay', asyncHandler(ctrl.initiatePayment));

// Admin endpoints
router.use('/admin', requireRole('ADMIN'));
router.get('/admin', asyncHandler(ctrl.adminList));
router.get('/admin/:id', asyncHandler(ctrl.adminGet));
router.post('/admin/:id/reply', asyncHandler(ctrl.adminReply));
router.post('/admin/:id/mark-paid', asyncHandler(ctrl.adminMarkPaid));
router.post('/admin/:id/cancel', asyncHandler(ctrl.adminCancel));

module.exports = router;