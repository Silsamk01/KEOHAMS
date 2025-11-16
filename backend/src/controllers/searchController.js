const SearchService = require('../services/searchService');

class SearchController {
  /**
   * Search products
   * GET /api/search
   */
  static async searchProducts(req, res) {
    try {
      const { q, categoryId, minPrice, maxPrice, stockStatus, inStockOnly, tags, sortBy, page = 1, limit = 20 } = req.query;
      const userId = req.user ? req.user.id : null;

      const filters = {
        categoryId,
        minPrice,
        maxPrice,
        stockStatus,
        inStockOnly,
        tags,
        sortBy
      };

      const result = await SearchService.searchProducts(
        q,
        filters,
        userId,
        parseInt(page),
        parseInt(limit)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Search products error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get search suggestions (autocomplete)
   * GET /api/search/suggestions
   */
  static async getSearchSuggestions(req, res) {
    try {
      const { q, limit = 10 } = req.query;

      const suggestions = await SearchService.getSearchSuggestions(q, parseInt(limit));

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      console.error('Get suggestions error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Track product view
   * POST /api/search/track-view/:productId
   */
  static async trackProductView(req, res) {
    try {
      const { productId } = req.params;
      const userId = req.user ? req.user.id : null;

      await SearchService.trackRecentlyViewed(userId, productId);

      res.json({
        success: true,
        message: 'Product view tracked'
      });
    } catch (error) {
      console.error('Track product view error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get recently viewed products
   * GET /api/search/recently-viewed
   */
  static async getRecentlyViewed(req, res) {
    try {
      const { limit = 10 } = req.query;
      const userId = req.user.id;

      const products = await SearchService.getRecentlyViewed(userId, parseInt(limit));

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Get recently viewed error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get related products
   * GET /api/search/related/:productId
   */
  static async getRelatedProducts(req, res) {
    try {
      const { productId } = req.params;
      const { limit = 6 } = req.query;

      const products = await SearchService.getRelatedProducts(productId, parseInt(limit));

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Get related products error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get search history
   * GET /api/search/history
   */
  static async getSearchHistory(req, res) {
    try {
      const { limit = 20 } = req.query;
      const userId = req.user.id;

      const history = await SearchService.getSearchHistory(userId, parseInt(limit));

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get search history error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get popular searches
   * GET /api/search/popular
   */
  static async getPopularSearches(req, res) {
    try {
      const { limit = 10 } = req.query;

      const popular = await SearchService.getPopularSearches(parseInt(limit));

      res.json({
        success: true,
        data: popular
      });
    } catch (error) {
      console.error('Get popular searches error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SearchController;
