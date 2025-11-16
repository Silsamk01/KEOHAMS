const ReviewService = require('../services/reviewService');

/**
 * Submit a product review
 */
exports.submitReview = async (req, res) => {
  try {
    const { product_id, order_id, rating, title, comment } = req.body;

    if (!product_id || !rating || !title || !comment) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const review = await ReviewService.submitReview(
      req.user.id,
      product_id,
      order_id,
      rating,
      title,
      comment
    );

    return res.status(201).json({
      message: 'Review submitted successfully. It will be visible after moderation.',
      review
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ message: error.message || 'Failed to submit review' });
  }
};

/**
 * Get reviews for a product
 */
exports.getProductReviews = async (req, res) => {
  try {
    const { product_id } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sort_by || 'recent';

    const result = await ReviewService.getProductReviews(
      product_id,
      'APPROVED',
      limit,
      offset,
      sortBy
    );

    return res.json(result);
  } catch (error) {
    console.error('Get product reviews error:', error);
    return res.status(500).json({ message: 'Failed to retrieve reviews' });
  }
};

/**
 * Get single review
 */
exports.getReview = async (req, res) => {
  try {
    const { id } = req.params;
    const review = await ReviewService.getReviewById(id);
    return res.json(review);
  } catch (error) {
    console.error('Get review error:', error);
    const status = error.message === 'Review not found' ? 404 : 500;
    return res.status(status).json({ message: error.message });
  }
};

/**
 * Vote on review
 */
exports.voteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body;

    if (!vote_type || !['HELPFUL', 'NOT_HELPFUL'].includes(vote_type)) {
      return res.status(400).json({ message: 'Invalid vote_type. Must be HELPFUL or NOT_HELPFUL' });
    }

    const review = await ReviewService.voteReview(id, req.user.id, vote_type);
    return res.json({
      message: 'Vote recorded',
      review
    });
  } catch (error) {
    console.error('Vote review error:', error);
    return res.status(500).json({ message: 'Failed to record vote' });
  }
};

/**
 * Get user's reviews
 */
exports.getUserReviews = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await ReviewService.getUserReviews(req.user.id, limit, offset);
    return res.json(result);
  } catch (error) {
    console.error('Get user reviews error:', error);
    return res.status(500).json({ message: 'Failed to retrieve reviews' });
  }
};

/**
 * Delete review
 */
exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'ADMIN';

    await ReviewService.deleteReview(id, req.user.id, isAdmin);
    return res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    const status = error.message === 'Access denied' ? 403 : 500;
    return res.status(status).json({ message: error.message || 'Failed to delete review' });
  }
};

/**
 * Admin: Get pending reviews
 */
exports.getPendingReviews = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await ReviewService.getPendingReviews(limit, offset);
    return res.json(result);
  } catch (error) {
    console.error('Get pending reviews error:', error);
    return res.status(500).json({ message: 'Failed to retrieve pending reviews' });
  }
};

/**
 * Admin: Moderate review
 */
exports.moderateReview = async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;
    const { status, moderation_notes } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED' });
    }

    const review = await ReviewService.moderateReview(
      id,
      req.user.id,
      status,
      moderation_notes
    );

    return res.json({
      message: `Review ${status.toLowerCase()} successfully`,
      review
    });
  } catch (error) {
    console.error('Moderate review error:', error);
    return res.status(500).json({ message: error.message || 'Failed to moderate review' });
  }
};
