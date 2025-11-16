const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/analyticsController');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/adminAuth');

// Event tracking (can be public or authenticated)
router.post('/track', AnalyticsController.trackEvent);

// Admin analytics routes
router.use(verifyToken, isAdmin);

router.get('/dashboard', AnalyticsController.getDashboardSummary);
router.get('/revenue', AnalyticsController.getRevenueReport);
router.get('/products/top', AnalyticsController.getTopProducts);
router.get('/products/:productId/performance', AnalyticsController.getProductPerformance);
router.get('/funnel', AnalyticsController.getConversionFunnel);
router.get('/customers', AnalyticsController.getCustomerAnalytics);
router.get('/affiliates', AnalyticsController.getAffiliateMetrics);

module.exports = router;
