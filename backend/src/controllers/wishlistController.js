const WishlistService = require('../services/wishlistService');

/**
 * Create new wishlist
 */
exports.createWishlist = async (req, res) => {
  try {
    const { name, description, is_public } = req.body;
    const wishlist = await WishlistService.createWishlist(
      req.user.id,
      name,
      description,
      is_public
    );

    return res.status(201).json(wishlist);
  } catch (error) {
    console.error('Create wishlist error:', error);
    return res.status(500).json({ message: error.message || 'Failed to create wishlist' });
  }
};

/**
 * Get user's wishlists
 */
exports.getUserWishlists = async (req, res) => {
  try {
    const wishlists = await WishlistService.getUserWishlists(req.user.id);
    return res.json(wishlists);
  } catch (error) {
    console.error('Get wishlists error:', error);
    return res.status(500).json({ message: 'Failed to retrieve wishlists' });
  }
};

/**
 * Get wishlist by ID with items
 */
exports.getWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const wishlist = await WishlistService.getWishlistById(id, req.user.id);
    return res.json(wishlist);
  } catch (error) {
    console.error('Get wishlist error:', error);
    const status = error.message === 'Access denied' ? 403 : 
                   error.message === 'Wishlist not found' ? 404 : 500;
    return res.status(status).json({ message: error.message });
  }
};

/**
 * Get shared wishlist by token
 */
exports.getSharedWishlist = async (req, res) => {
  try {
    const { token } = req.params;
    const visitorIp = req.ip || req.connection?.remoteAddress;
    const visitorUserAgent = req.headers['user-agent'];
    const viewedByUserId = req.user ? req.user.id : null;

    const wishlist = await WishlistService.getWishlistByShareToken(
      token,
      visitorIp,
      visitorUserAgent,
      viewedByUserId
    );

    return res.json(wishlist);
  } catch (error) {
    console.error('Get shared wishlist error:', error);
    return res.status(404).json({ message: error.message || 'Shared wishlist not found' });
  }
};

/**
 * Update wishlist
 */
exports.updateWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const wishlist = await WishlistService.updateWishlist(id, req.user.id, updates);
    return res.json(wishlist);
  } catch (error) {
    console.error('Update wishlist error:', error);
    return res.status(500).json({ message: error.message || 'Failed to update wishlist' });
  }
};

/**
 * Delete wishlist
 */
exports.deleteWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await WishlistService.deleteWishlist(id, req.user.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    return res.json({ message: 'Wishlist deleted successfully' });
  } catch (error) {
    console.error('Delete wishlist error:', error);
    return res.status(500).json({ message: 'Failed to delete wishlist' });
  }
};

/**
 * Add item to wishlist
 */
exports.addItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_id, quantity, notify_price_drop, target_price } = req.body;

    if (!product_id) {
      return res.status(400).json({ message: 'product_id is required' });
    }

    const item = await WishlistService.addItem(
      id,
      req.user.id,
      product_id,
      quantity,
      notify_price_drop,
      target_price
    );

    return res.status(201).json(item);
  } catch (error) {
    console.error('Add item error:', error);
    return res.status(500).json({ message: error.message || 'Failed to add item to wishlist' });
  }
};

/**
 * Update wishlist item
 */
exports.updateItem = async (req, res) => {
  try {
    const { id, item_id } = req.params;
    const updates = req.body;

    const item = await WishlistService.updateItem(id, req.user.id, item_id, updates);
    return res.json(item);
  } catch (error) {
    console.error('Update item error:', error);
    return res.status(500).json({ message: error.message || 'Failed to update item' });
  }
};

/**
 * Remove item from wishlist
 */
exports.removeItem = async (req, res) => {
  try {
    const { id, item_id } = req.params;
    const deleted = await WishlistService.removeItem(id, req.user.id, item_id);

    if (!deleted) {
      return res.status(404).json({ message: 'Item not found' });
    }

    return res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Remove item error:', error);
    return res.status(500).json({ message: error.message || 'Failed to remove item' });
  }
};

/**
 * Move all wishlist items to cart
 */
exports.moveToCart = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await WishlistService.moveToCart(id, req.user.id);

    return res.json({
      message: `Moved ${result.items_moved} of ${result.items_total} items to cart`,
      ...result
    });
  } catch (error) {
    console.error('Move to cart error:', error);
    return res.status(500).json({ message: error.message || 'Failed to move items to cart' });
  }
};

/**
 * Check price drops (admin/cron)
 */
exports.checkPriceDrops = async (req, res) => {
  try {
    const alerts = await WishlistService.checkPriceDrops();
    
    // In production, trigger email notifications here
    // for (const alert of alerts) {
    //   await sendPriceDropEmail(alert);
    //   await WishlistService.markAlertSent(alert.id);
    // }

    return res.json({
      message: `Found ${alerts.length} price drop alerts`,
      alerts
    });
  } catch (error) {
    console.error('Check price drops error:', error);
    return res.status(500).json({ message: 'Failed to check price drops' });
  }
};
