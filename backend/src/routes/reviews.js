const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate } = require('../middlewares/auth');

// Public routes
router.get('/product/:product_id', reviewController.getProductReviews);
router.get('/:id', reviewController.getReview);

// Protected routes
router.post('/', authenticate, reviewController.submitReview);
router.post('/:id/vote', authenticate, reviewController.voteReview);
router.get('/user/my-reviews', authenticate, reviewController.getUserReviews);
router.delete('/:id', authenticate, reviewController.deleteReview);

// Admin routes
router.get('/admin/pending', authenticate, reviewController.getPendingReviews);
router.put('/admin/:id/moderate', authenticate, reviewController.moderateReview);

module.exports = router;
