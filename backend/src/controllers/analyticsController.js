const AnalyticsService = require('../services/analyticsService');

class AnalyticsController {
  /**
   * Track event
   * POST /api/analytics/track
   */
  static async trackEvent(req, res) {
    try {
      const { eventType, eventData } = req.body;

      if (!eventType) {
        return res.status(400).json({ error: 'Event type is required' });
      }

      await AnalyticsService.trackEvent(eventType, eventData, req);

      res.json({ success: true, message: 'Event tracked' });
    } catch (error) {
      console.error('Track event error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get dashboard summary
   * GET /api/analytics/dashboard
   */
  static async getDashboardSummary(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const summary = await AnalyticsService.getDashboardSummary(startDate, endDate);

      res.json({ success: true, data: summary });
    } catch (error) {
      console.error('Get dashboard summary error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get revenue report
   * GET /api/analytics/revenue
   */
  static async getRevenueReport(req, res) {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const report = await AnalyticsService.getRevenueReport(startDate, endDate, groupBy);

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Get revenue report error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get top products
   * GET /api/analytics/products/top
   */
  static async getTopProducts(req, res) {
    try {
      const { startDate, endDate, limit = 10 } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const products = await AnalyticsService.getTopProducts(startDate, endDate, parseInt(limit));

      res.json({ success: true, data: products });
    } catch (error) {
      console.error('Get top products error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get conversion funnel
   * GET /api/analytics/funnel
   */
  static async getConversionFunnel(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const funnel = await AnalyticsService.getConversionFunnel(startDate, endDate);

      res.json({ success: true, data: funnel });
    } catch (error) {
      console.error('Get conversion funnel error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get customer analytics
   * GET /api/analytics/customers
   */
  static async getCustomerAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const analytics = await AnalyticsService.getCustomerAnalytics(startDate, endDate);

      res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('Get customer analytics error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get affiliate metrics
   * GET /api/analytics/affiliates
   */
  static async getAffiliateMetrics(req, res) {
    try {
      const { startDate, endDate, affiliateId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const metrics = await AnalyticsService.getAffiliateMetrics(
        startDate,
        endDate,
        affiliateId || null
      );

      res.json({ success: true, data: metrics });
    } catch (error) {
      console.error('Get affiliate metrics error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get product performance
   * GET /api/analytics/products/:productId/performance
   */
  static async getProductPerformance(req, res) {
    try {
      const { productId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required' });
      }

      const performance = await AnalyticsService.getProductPerformance(
        productId,
        startDate,
        endDate
      );

      res.json({ success: true, data: performance });
    } catch (error) {
      console.error('Get product performance error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = AnalyticsController;
