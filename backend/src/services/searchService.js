const db = require('../config/db');

class SearchService {
  /**
   * Search products with fulltext search and filters
   */
  static async searchProducts(query, filters = {}, userId = null, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    let productsQuery = db('products')
      .where('active', true)
      .select(
        'products.*',
        'categories.name as category_name'
      )
      .leftJoin('categories', 'products.category_id', 'categories.id');

    // Fulltext search if query provided
    if (query && query.trim().length > 0) {
      const searchTerm = query.trim();
      
      // Use MySQL FULLTEXT search
      productsQuery = productsQuery
        .whereRaw('MATCH(products.title, products.description) AGAINST(? IN NATURAL LANGUAGE MODE)', [searchTerm])
        .orWhere('products.title', 'like', `%${searchTerm}%`)
        .orWhere('products.description', 'like', `%${searchTerm}%`)
        .orWhere('products.tags', 'like', `%${searchTerm}%`)
        .orWhere('products.search_keywords', 'like', `%${searchTerm}%`);

      // Track search
      await this.trackSearch(searchTerm, userId);
    }

    // Apply filters
    if (filters.categoryId) {
      productsQuery = productsQuery.where('products.category_id', filters.categoryId);
    }

    if (filters.minPrice) {
      productsQuery = productsQuery.where('products.price_per_unit', '>=', parseFloat(filters.minPrice));
    }

    if (filters.maxPrice) {
      productsQuery = productsQuery.where('products.price_per_unit', '<=', parseFloat(filters.maxPrice));
    }

    if (filters.stockStatus) {
      productsQuery = productsQuery.where('products.stock_status', filters.stockStatus);
    }

    if (filters.inStockOnly === 'true' || filters.inStockOnly === true) {
      productsQuery = productsQuery.whereIn('products.stock_status', ['IN_STOCK', 'LOW_STOCK']);
    }

    if (filters.tags) {
      const tags = Array.isArray(filters.tags) ? filters.tags : [filters.tags];
      tags.forEach(tag => {
        productsQuery = productsQuery.where('products.tags', 'like', `%${tag}%`);
      });
    }

    // Sorting
    const sortBy = filters.sortBy || 'relevance';
    switch (sortBy) {
      case 'price_asc':
        productsQuery = productsQuery.orderBy('products.price_per_unit', 'asc');
        break;
      case 'price_desc':
        productsQuery = productsQuery.orderBy('products.price_per_unit', 'desc');
        break;
      case 'newest':
        productsQuery = productsQuery.orderBy('products.created_at', 'desc');
        break;
      case 'name':
        productsQuery = productsQuery.orderBy('products.title', 'asc');
        break;
      default:
        // Relevance - if search query, use MATCH score, otherwise by created_at
        if (query && query.trim().length > 0) {
          productsQuery = productsQuery.orderByRaw('MATCH(products.title, products.description) AGAINST(?) DESC', [query.trim()]);
        } else {
          productsQuery = productsQuery.orderBy('products.created_at', 'desc');
        }
    }

    // Get total count for pagination
    const countQuery = productsQuery.clone().clearSelect().clearOrder().count('* as count');
    const totalResult = await countQuery.first();
    const total = totalResult ? totalResult.count : 0;

    // Get paginated results
    const products = await productsQuery.limit(limit).offset(offset);

    // Update search history with result count if query provided
    if (query && query.trim().length > 0) {
      await this.updateSearchResultCount(query.trim(), total);
    }

    return {
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      },
      filters,
      query
    };
  }

  /**
   * Get search suggestions (autocomplete)
   */
  static async getSearchSuggestions(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerm = query.trim();

    // Get popular searches matching the query
    const popularSearches = await db('popular_searches')
      .where('search_term', 'like', `%${searchTerm}%`)
      .orderBy('search_count', 'desc')
      .limit(limit)
      .select('search_term', 'search_count');

    // Get product titles matching the query
    const productMatches = await db('products')
      .where('active', true)
      .where(function() {
        this.where('title', 'like', `%${searchTerm}%`)
            .orWhere('tags', 'like', `%${searchTerm}%`);
      })
      .limit(limit)
      .select('title as search_term')
      .distinct();

    // Combine and deduplicate
    const suggestions = [...popularSearches, ...productMatches]
      .reduce((acc, item) => {
        if (!acc.some(i => i.search_term.toLowerCase() === item.search_term.toLowerCase())) {
          acc.push(item);
        }
        return acc;
      }, [])
      .slice(0, limit);

    return suggestions;
  }

  /**
   * Track search query
   */
  static async trackSearch(query, userId = null) {
    const searchTerm = query.trim().toLowerCase();

    // Record in search history
    await db('search_history').insert({
      user_id: userId,
      search_query: searchTerm,
      searched_at: db.fn.now()
    });

    // Update popular searches
    const existing = await db('popular_searches')
      .where('search_term', searchTerm)
      .first();

    if (existing) {
      await db('popular_searches')
        .where('id', existing.id)
        .increment('search_count', 1)
        .update({ last_searched: db.fn.now() });
    } else {
      await db('popular_searches').insert({
        search_term: searchTerm,
        search_count: 1,
        last_searched: db.fn.now()
      });
    }
  }

  /**
   * Update search result count
   */
  static async updateSearchResultCount(query, resultCount) {
    const searchTerm = query.trim().toLowerCase();

    const existing = await db('popular_searches')
      .where('search_term', searchTerm)
      .first();

    if (existing) {
      // Calculate moving average
      const newAvg = Math.round((existing.result_count_avg * (existing.search_count - 1) + resultCount) / existing.search_count);
      
      await db('popular_searches')
        .where('id', existing.id)
        .update({ result_count_avg: newAvg });
    }
  }

  /**
   * Track recently viewed product
   */
  static async trackRecentlyViewed(userId, productId) {
    if (!userId) return;

    const existing = await db('recently_viewed')
      .where('user_id', userId)
      .where('product_id', productId)
      .first();

    if (existing) {
      await db('recently_viewed')
        .where('id', existing.id)
        .update({
          viewed_at: db.fn.now(),
          view_count: existing.view_count + 1
        });
    } else {
      await db('recently_viewed').insert({
        user_id: userId,
        product_id: productId,
        viewed_at: db.fn.now(),
        view_count: 1
      });
    }

    // Keep only last 50 viewed products per user
    const allViewed = await db('recently_viewed')
      .where('user_id', userId)
      .orderBy('viewed_at', 'desc')
      .select('id');

    if (allViewed.length > 50) {
      const toDelete = allViewed.slice(50).map(v => v.id);
      await db('recently_viewed').whereIn('id', toDelete).del();
    }
  }

  /**
   * Get recently viewed products
   */
  static async getRecentlyViewed(userId, limit = 10) {
    if (!userId) return [];

    const viewed = await db('recently_viewed')
      .join('products', 'recently_viewed.product_id', 'products.id')
      .where('recently_viewed.user_id', userId)
      .where('products.active', true)
      .orderBy('recently_viewed.viewed_at', 'desc')
      .limit(limit)
      .select(
        'products.*',
        'recently_viewed.viewed_at',
        'recently_viewed.view_count'
      );

    return viewed;
  }

  /**
   * Get related products based on category and tags
   */
  static async getRelatedProducts(productId, limit = 6) {
    const product = await db('products')
      .where('id', productId)
      .first('category_id', 'tags');

    if (!product) return [];

    let relatedQuery = db('products')
      .where('products.id', '!=', productId)
      .where('products.active', true)
      .leftJoin('categories', 'products.category_id', 'categories.id')
      .select(
        'products.*',
        'categories.name as category_name'
      );

    // Prioritize same category
    if (product.category_id) {
      relatedQuery = relatedQuery.where('products.category_id', product.category_id);
    }

    // If product has tags, find products with matching tags
    if (product.tags) {
      const tags = product.tags.split(',').map(t => t.trim()).filter(t => t);
      if (tags.length > 0) {
        tags.forEach(tag => {
          relatedQuery = relatedQuery.orWhere('products.tags', 'like', `%${tag}%`);
        });
      }
    }

    const related = await relatedQuery
      .orderBy('products.created_at', 'desc')
      .limit(limit);

    return related;
  }

  /**
   * Get search history for user
   */
  static async getSearchHistory(userId, limit = 20) {
    if (!userId) return [];

    const history = await db('search_history')
      .where('user_id', userId)
      .orderBy('searched_at', 'desc')
      .limit(limit)
      .select('search_query', 'searched_at', 'results_count')
      .distinct();

    return history;
  }

  /**
   * Get popular searches
   */
  static async getPopularSearches(limit = 10) {
    const popular = await db('popular_searches')
      .orderBy('search_count', 'desc')
      .limit(limit)
      .select('search_term', 'search_count');

    return popular;
  }
}

module.exports = SearchService;
