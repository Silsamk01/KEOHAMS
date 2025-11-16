/**
 * Payment Routes
 */

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/auth');

// Public routes
router.get('/public-key', paymentController.getPublicKey);
router.post('/webhook', paymentController.handleWebhook); // No auth - Paystack webhook

// Protected routes
router.use(verifyToken);

router.post('/initialize', paymentController.initializePayment);
router.get('/verify', paymentController.verifyPayment);
router.get('/history', paymentController.getPaymentHistory);
router.get('/methods', paymentController.getSavedPaymentMethods);
router.delete('/methods/:id', paymentController.deleteSavedPaymentMethod);

module.exports = router;
