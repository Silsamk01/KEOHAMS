const db = require('../config/db');
const crypto = require('crypto');

class WishlistService {
  /**
   * Create a new wishlist for user
   */
  static async createWishlist(userId, name, description, isPublic) {
    const [wishlistId] = await db('wishlists').insert({
      user_id: userId,
      name: name || 'My Wishlist',
      description,
      is_public: isPublic || false,
      share_token: isPublic ? crypto.randomBytes(32).toString('hex') : null
    });

    return await db('wishlists').where('id', wishlistId).first();
  }

  /**
   * Get user's wishlists
   */
  static async getUserWishlists(userId) {
    return await db('wishlists')
      .where('user_id', userId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Get wishlist by ID
   */
  static async getWishlistById(wishlistId, userId = null) {
    const wishlist = await db('wishlists').where('id', wishlistId).first();
    
    if (!wishlist) {
      throw new Error('Wishlist not found');
    }

    // Check access permissions
    if (!wishlist.is_public && userId !== wishlist.user_id) {
      throw new Error('Access denied');
    }

    // Get wishlist items with product details
    const items = await db('wishlist_items as wi')
      .join('products as p', 'wi.product_id', 'p.id')
      .leftJoin('product_images as pi', function() {
        this.on('pi.product_id', '=', 'p.id')
          .andOn('pi.is_primary', '=', db.raw('1'));
      })
      .where('wi.wishlist_id', wishlistId)
      .select(
        'wi.*',
        'p.title as product_name',
        'p.price as current_price',
        'p.stock_quantity',
        'p.slug',
        'pi.image_url as product_image'
      )
      .orderBy('wi.created_at', 'desc');

    return {
      ...wishlist,
      items,
      item_count: items.length,
      total_value: items.reduce((sum, item) => sum + parseFloat(item.current_price || 0) * item.quantity, 0)
    };
  }

  /**
   * Get wishlist by share token
   */
  static async getWishlistByShareToken(shareToken, visitorIp, visitorUserAgent, viewedByUserId = null) {
    const wishlist = await db('wishlists')
      .where('share_token', shareToken)
      .where('is_public', true)
      .first();

    if (!wishlist) {
      throw new Error('Shared wishlist not found');
    }

    // Track view
    await db('wishlist_shares').insert({
      wishlist_id: wishlist.id,
      visitor_ip: visitorIp,
      visitor_user_agent: visitorUserAgent,
      viewed_by_user_id: viewedByUserId
    });

    return await this.getWishlistById(wishlist.id, wishlist.user_id);
  }

  /**
   * Add item to wishlist
   */
  static async addItem(wishlistId, userId, productId, quantity, notifyPriceDrop, targetPrice) {
    // Verify wishlist ownership
    const wishlist = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .first();

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    // Get product current price
    const product = await db('products').where('id', productId).first();
    if (!product) {
      throw new Error('Product not found');
    }

    // Check if item already exists
    const existing = await db('wishlist_items')
      .where('wishlist_id', wishlistId)
      .where('product_id', productId)
      .first();

    if (existing) {
      // Update quantity
      await db('wishlist_items')
        .where('id', existing.id)
        .update({
          quantity: existing.quantity + (quantity || 1),
          notify_price_drop: notifyPriceDrop !== undefined ? notifyPriceDrop : existing.notify_price_drop,
          target_price: targetPrice !== undefined ? targetPrice : existing.target_price,
          updated_at: db.fn.now()
        });

      return await db('wishlist_items').where('id', existing.id).first();
    }

    // Insert new item
    const [itemId] = await db('wishlist_items').insert({
      wishlist_id: wishlistId,
      product_id: productId,
      quantity: quantity || 1,
      price_when_added: product.price,
      notify_price_drop: notifyPriceDrop || false,
      target_price: targetPrice || null
    });

    return await db('wishlist_items').where('id', itemId).first();
  }

  /**
   * Remove item from wishlist
   */
  static async removeItem(wishlistId, userId, itemId) {
    // Verify ownership
    const wishlist = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .first();

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    const deleted = await db('wishlist_items')
      .where('id', itemId)
      .where('wishlist_id', wishlistId)
      .delete();

    return deleted > 0;
  }

  /**
   * Update wishlist item
   */
  static async updateItem(wishlistId, userId, itemId, updates) {
    // Verify ownership
    const wishlist = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .first();

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    const allowedUpdates = {
      quantity: updates.quantity,
      notes: updates.notes,
      notify_price_drop: updates.notify_price_drop,
      target_price: updates.target_price
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }

    allowedUpdates.updated_at = db.fn.now();

    await db('wishlist_items')
      .where('id', itemId)
      .where('wishlist_id', wishlistId)
      .update(allowedUpdates);

    return await db('wishlist_items').where('id', itemId).first();
  }

  /**
   * Delete wishlist
   */
  static async deleteWishlist(wishlistId, userId) {
    const deleted = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .delete();

    return deleted > 0;
  }

  /**
   * Update wishlist settings
   */
  static async updateWishlist(wishlistId, userId, updates) {
    const wishlist = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .first();

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    const allowedUpdates = {
      name: updates.name,
      description: updates.description,
      is_public: updates.is_public
    };

    // Remove undefined values
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );

    // Generate share token if making public
    if (updates.is_public && !wishlist.share_token) {
      allowedUpdates.share_token = crypto.randomBytes(32).toString('hex');
    }

    // Remove share token if making private
    if (updates.is_public === false) {
      allowedUpdates.share_token = null;
    }

    allowedUpdates.updated_at = db.fn.now();

    await db('wishlists')
      .where('id', wishlistId)
      .update(allowedUpdates);

    return await db('wishlists').where('id', wishlistId).first();
  }

  /**
   * Check for price drops and create alerts
   */
  static async checkPriceDrops() {
    // Get all wishlist items with price drop notifications enabled
    const items = await db('wishlist_items as wi')
      .join('products as p', 'wi.product_id', 'p.id')
      .join('wishlists as w', 'wi.wishlist_id', 'w.id')
      .where('wi.notify_price_drop', true)
      .where('p.price', '<', db.raw('wi.price_when_added'))
      .select(
        'wi.*',
        'p.price as current_price',
        'p.title as product_name',
        'w.user_id'
      );

    const alerts = [];

    for (const item of items) {
      // Check if target price met or just any drop
      const shouldAlert = !item.target_price || item.current_price <= item.target_price;

      if (shouldAlert) {
        // Check if alert already sent for this price
        const existingAlert = await db('price_drop_alerts')
          .where('wishlist_item_id', item.id)
          .where('new_price', item.current_price)
          .first();

        if (!existingAlert) {
          const [alertId] = await db('price_drop_alerts').insert({
            wishlist_item_id: item.id,
            user_id: item.user_id,
            old_price: item.price_when_added,
            new_price: item.current_price,
            notification_sent: false
          });

          alerts.push({
            id: alertId,
            user_id: item.user_id,
            product_name: item.product_name,
            old_price: item.price_when_added,
            new_price: item.current_price,
            savings: item.price_when_added - item.current_price
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Mark price drop alert as sent
   */
  static async markAlertSent(alertId) {
    await db('price_drop_alerts')
      .where('id', alertId)
      .update({
        notification_sent: true,
        sent_at: db.fn.now()
      });
  }

  /**
   * Move all items to cart
   */
  static async moveToCart(wishlistId, userId) {
    const wishlist = await db('wishlists')
      .where('id', wishlistId)
      .where('user_id', userId)
      .first();

    if (!wishlist) {
      throw new Error('Wishlist not found or access denied');
    }

    const items = await db('wishlist_items')
      .where('wishlist_id', wishlistId);

    const cartItems = [];

    for (const item of items) {
      // Check product availability
      const product = await db('products')
        .where('id', item.product_id)
        .first();

      if (product && product.stock_quantity >= item.quantity) {
        // Add to cart (assuming cart_items table exists)
        const [cartItemId] = await db('cart_items').insert({
          user_id: userId,
          product_id: item.product_id,
          quantity: item.quantity
        }).onConflict(['user_id', 'product_id']).merge();

        cartItems.push(cartItemId);
      }
    }

    return {
      items_moved: cartItems.length,
      items_total: items.length
    };
  }
}

module.exports = WishlistService;
