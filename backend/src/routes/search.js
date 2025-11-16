const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');
const { verifyToken } = require('../middlewares/auth');

// Public routes
router.get('/', SearchController.searchProducts);
router.get('/suggestions', SearchController.getSearchSuggestions);
router.get('/related/:productId', SearchController.getRelatedProducts);
router.get('/popular', SearchController.getPopularSearches);

// Protected routes
router.post('/track-view/:productId', verifyToken, SearchController.trackProductView);
router.get('/recently-viewed', verifyToken, SearchController.getRecentlyViewed);
router.get('/history', verifyToken, SearchController.getSearchHistory);

module.exports = router;
