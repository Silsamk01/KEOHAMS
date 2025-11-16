const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate, optionalAuth } = require('../middlewares/auth');

// Public routes (shared wishlists)
router.get('/shared/:token', optionalAuth, wishlistController.getSharedWishlist);

// Protected routes
router.post('/', authenticate, wishlistController.createWishlist);
router.get('/', authenticate, wishlistController.getUserWishlists);
router.get('/:id', authenticate, wishlistController.getWishlist);
router.put('/:id', authenticate, wishlistController.updateWishlist);
router.delete('/:id', authenticate, wishlistController.deleteWishlist);

// Wishlist items
router.post('/:id/items', authenticate, wishlistController.addItem);
router.put('/:id/items/:item_id', authenticate, wishlistController.updateItem);
router.delete('/:id/items/:item_id', authenticate, wishlistController.removeItem);
router.post('/:id/move-to-cart', authenticate, wishlistController.moveToCart);

// Admin/Cron routes
router.get('/admin/price-drops', authenticate, wishlistController.checkPriceDrops);

module.exports = router;
