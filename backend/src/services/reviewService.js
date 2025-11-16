const db = require('../config/db');

class ReviewService {
  /**
   * Submit a product review
   */
  static async submitReview(userId, productId, orderId, rating, title, comment) {
    // Check if user already reviewed this product
    const existing = await db('product_reviews')
      .where('user_id', userId)
      .where('product_id', productId)
      .first();

    if (existing) {
      throw new Error('You have already reviewed this product');
    }

    // Check if verified purchase
    let isVerifiedPurchase = false;
    if (orderId) {
      const orderItem = await db('order_items as oi')
        .join('orders as o', 'oi.order_id', 'o.id')
        .where('o.id', orderId)
        .where('o.user_id', userId)
        .where('oi.product_id', productId)
        .where('o.status', 'DELIVERED')
        .first();

      isVerifiedPurchase = !!orderItem;
    }

    // Insert review
    const [reviewId] = await db('product_reviews').insert({
      product_id: productId,
      user_id: userId,
      order_id: orderId,
      rating,
      title,
      comment,
      is_verified_purchase: isVerifiedPurchase,
      status: 'PENDING' // Requires moderation
    });

    // Update product rating statistics
    await this.updateProductRating(productId);

    return await db('product_reviews').where('id', reviewId).first();
  }

  /**
   * Get reviews for a product
   */
  static async getProductReviews(productId, status = 'APPROVED', limit = 20, offset = 0, sortBy = 'recent') {
    let query = db('product_reviews as pr')
      .join('users as u', 'pr.user_id', 'u.id')
      .where('pr.product_id', productId)
      .where('pr.status', status)
      .select(
        'pr.*',
        'u.name as user_name',
        'u.avatar_url as user_avatar'
      )
      .limit(limit)
      .offset(offset);

    // Sort options
    switch (sortBy) {
      case 'recent':
        query = query.orderBy('pr.created_at', 'desc');
        break;
      case 'helpful':
        query = query.orderBy('pr.helpful_count', 'desc');
        break;
      case 'rating_high':
        query = query.orderBy('pr.rating', 'desc');
        break;
      case 'rating_low':
        query = query.orderBy('pr.rating', 'asc');
        break;
      default:
        query = query.orderBy('pr.created_at', 'desc');
    }

    const reviews = await query;

    // Get rating distribution
    const distribution = await db('product_reviews')
      .where('product_id', productId)
      .where('status', 'APPROVED')
      .select('rating')
      .groupBy('rating')
      .count('* as count');

    const ratingStats = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };
    distribution.forEach(d => {
      ratingStats[d.rating] = d.count;
    });

    const total = await db('product_reviews')
      .where('product_id', productId)
      .where('status', status)
      .count('* as count')
      .first();

    return {
      reviews,
      rating_distribution: ratingStats,
      total: total.count,
      limit,
      offset
    };
  }

  /**
   * Get single review
   */
  static async getReviewById(reviewId) {
    const review = await db('product_reviews as pr')
      .join('users as u', 'pr.user_id', 'u.id')
      .leftJoin('products as p', 'pr.product_id', 'p.id')
      .where('pr.id', reviewId)
      .select(
        'pr.*',
        'u.name as user_name',
        'u.avatar_url as user_avatar',
        'p.title as product_name',
        'p.slug as product_slug'
      )
      .first();

    if (!review) {
      throw new Error('Review not found');
    }

    // Get images if any
    const images = await db('review_images')
      .where('review_id', reviewId)
      .orderBy('display_order');

    return { ...review, images };
  }

  /**
   * Vote on review (helpful/not helpful)
   */
  static async voteReview(reviewId, userId, voteType) {
    // Check if user already voted
    const existing = await db('review_votes')
      .where('review_id', reviewId)
      .where('user_id', userId)
      .first();

    if (existing) {
      // Update vote if changed
      if (existing.vote_type !== voteType) {
        await db('review_votes')
          .where('id', existing.id)
          .update({ vote_type: voteType, voted_at: db.fn.now() });

        // Update counts
        if (voteType === 'HELPFUL') {
          await db('product_reviews')
            .where('id', reviewId)
            .increment('helpful_count', 1)
            .decrement('not_helpful_count', 1);
        } else {
          await db('product_reviews')
            .where('id', reviewId)
            .increment('not_helpful_count', 1)
            .decrement('helpful_count', 1);
        }
      }
    } else {
      // Insert new vote
      await db('review_votes').insert({
        review_id: reviewId,
        user_id: userId,
        vote_type: voteType
      });

      // Update count
      if (voteType === 'HELPFUL') {
        await db('product_reviews')
          .where('id', reviewId)
          .increment('helpful_count', 1);
      } else {
        await db('product_reviews')
          .where('id', reviewId)
          .increment('not_helpful_count', 1);
      }
    }

    return await db('product_reviews').where('id', reviewId).first();
  }

  /**
   * Moderate review (approve/reject)
   */
  static async moderateReview(reviewId, moderatorId, status, moderationNotes) {
    const review = await db('product_reviews').where('id', reviewId).first();
    
    if (!review) {
      throw new Error('Review not found');
    }

    await db('product_reviews')
      .where('id', reviewId)
      .update({
        status,
        moderated_by: moderatorId,
        moderation_notes: moderationNotes,
        moderated_at: db.fn.now()
      });

    // Update product rating if approved/rejected
    await this.updateProductRating(review.product_id);

    return await db('product_reviews').where('id', reviewId).first();
  }

  /**
   * Update product rating statistics
   */
  static async updateProductRating(productId) {
    const stats = await db('product_reviews')
      .where('product_id', productId)
      .where('status', 'APPROVED')
      .select(
        db.raw('AVG(rating) as avg_rating'),
        db.raw('COUNT(*) as review_count')
      )
      .first();

    await db('products')
      .where('id', productId)
      .update({
        rating_average: stats.avg_rating ? parseFloat(stats.avg_rating).toFixed(2) : null,
        rating_count: stats.review_count || 0
      });
  }

  /**
   * Delete review
   */
  static async deleteReview(reviewId, userId, isAdmin = false) {
    const review = await db('product_reviews').where('id', reviewId).first();

    if (!review) {
      throw new Error('Review not found');
    }

    // Only owner or admin can delete
    if (!isAdmin && review.user_id !== userId) {
      throw new Error('Access denied');
    }

    await db('product_reviews').where('id', reviewId).delete();

    // Update product rating
    await this.updateProductRating(review.product_id);

    return true;
  }

  /**
   * Get pending reviews (admin)
   */
  static async getPendingReviews(limit = 50, offset = 0) {
    const reviews = await db('product_reviews as pr')
      .join('users as u', 'pr.user_id', 'u.id')
      .join('products as p', 'pr.product_id', 'p.id')
      .where('pr.status', 'PENDING')
      .select(
        'pr.*',
        'u.name as user_name',
        'u.email as user_email',
        'p.title as product_name',
        'p.slug as product_slug'
      )
      .orderBy('pr.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await db('product_reviews')
      .where('status', 'PENDING')
      .count('* as count')
      .first();

    return {
      reviews,
      total: total.count,
      limit,
      offset
    };
  }

  /**
   * Get user's reviews
   */
  static async getUserReviews(userId, limit = 20, offset = 0) {
    const reviews = await db('product_reviews as pr')
      .join('products as p', 'pr.product_id', 'p.id')
      .leftJoin('product_images as pi', function() {
        this.on('pi.product_id', '=', 'p.id')
          .andOn('pi.is_primary', '=', db.raw('1'));
      })
      .where('pr.user_id', userId)
      .select(
        'pr.*',
        'p.title as product_name',
        'p.slug as product_slug',
        'pi.image_url as product_image'
      )
      .orderBy('pr.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await db('product_reviews')
      .where('user_id', userId)
      .count('* as count')
      .first();

    return {
      reviews,
      total: total.count,
      limit,
      offset
    };
  }
}

module.exports = ReviewService;
