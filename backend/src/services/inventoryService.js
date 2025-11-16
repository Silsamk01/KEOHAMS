const db = require('../config/db');

class InventoryService {
  /**
   * Update product stock quantity with history tracking
   */
  static async updateStock(productId, quantityChange, type, referenceId = null, referenceType = null, notes = null, userId = null, trx = null) {
    const dbConn = trx || db;

    // Get current product stock
    const product = await dbConn('products')
      .where('id', productId)
      .first('id', 'quantity', 'track_inventory', 'name');

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.track_inventory) {
      return { message: 'Inventory tracking disabled for this product' };
    }

    const quantityBefore = product.quantity;
    const quantityAfter = quantityBefore + quantityChange;

    if (quantityAfter < 0) {
      throw new Error(`Insufficient stock. Available: ${quantityBefore}, Requested: ${Math.abs(quantityChange)}`);
    }

    // Update product quantity
    await dbConn('products')
      .where('id', productId)
      .update({
        quantity: quantityAfter,
        updated_at: dbConn.fn.now()
      });

    // Record in inventory history
    const history = await dbConn('inventory_history').insert({
      product_id: productId,
      type,
      quantity_change: quantityChange,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      reference_id: referenceId,
      reference_type: referenceType,
      notes,
      created_by: userId
    });

    // Check for low stock and create alert if needed
    await this.checkLowStockAlert(productId, quantityAfter, dbConn);

    // Update stock status
    await this.updateStockStatus(productId, dbConn);

    return {
      product_id: productId,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      quantity_change: quantityChange,
      history_id: history[0]
    };
  }

  /**
   * Reserve stock for cart/checkout
   */
  static async reserveStock(productId, quantity, userId, type = 'CART', referenceId = null, referenceType = null, expiryMinutes = 30, trx = null) {
    const dbConn = trx || db;

    // Check available stock (quantity - reserved_quantity)
    const product = await dbConn('products')
      .where('id', productId)
      .first('id', 'quantity', 'reserved_quantity', 'track_inventory');

    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.track_inventory) {
      return { message: 'Inventory tracking disabled for this product' };
    }

    const availableStock = product.quantity - product.reserved_quantity;
    if (availableStock < quantity) {
      throw new Error(`Insufficient stock available. Available: ${availableStock}, Requested: ${quantity}`);
    }

    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Create reservation
    const reservation = await dbConn('stock_reservations').insert({
      product_id: productId,
      user_id: userId,
      quantity,
      type,
      reference_id: referenceId,
      reference_type: referenceType,
      expires_at: expiresAt,
      status: 'ACTIVE'
    });

    // Update reserved quantity
    await dbConn('products')
      .where('id', productId)
      .increment('reserved_quantity', quantity);

    // Update stock status
    await this.updateStockStatus(productId, dbConn);

    return {
      reservation_id: reservation[0],
      product_id: productId,
      quantity,
      expires_at: expiresAt
    };
  }

  /**
   * Release stock reservation
   */
  static async releaseReservation(reservationId, trx = null) {
    const dbConn = trx || db;

    const reservation = await dbConn('stock_reservations')
      .where('id', reservationId)
      .where('status', 'ACTIVE')
      .first();

    if (!reservation) {
      throw new Error('Active reservation not found');
    }

    // Update reservation status
    await dbConn('stock_reservations')
      .where('id', reservationId)
      .update({
        status: 'RELEASED',
        released_at: dbConn.fn.now()
      });

    // Decrease reserved quantity
    await dbConn('products')
      .where('id', reservation.product_id)
      .decrement('reserved_quantity', reservation.quantity);

    // Update stock status
    await this.updateStockStatus(reservation.product_id, dbConn);

    return {
      reservation_id: reservationId,
      product_id: reservation.product_id,
      quantity_released: reservation.quantity
    };
  }

  /**
   * Fulfill reservation (convert to order)
   */
  static async fulfillReservation(reservationId, trx = null) {
    const dbConn = trx || db;

    const reservation = await dbConn('stock_reservations')
      .where('id', reservationId)
      .where('status', 'ACTIVE')
      .first();

    if (!reservation) {
      throw new Error('Active reservation not found');
    }

    // Update reservation status
    await dbConn('stock_reservations')
      .where('id', reservationId)
      .update({
        status: 'FULFILLED',
        released_at: dbConn.fn.now()
      });

    // Decrease both quantity and reserved_quantity
    await dbConn('products')
      .where('id', reservation.product_id)
      .decrement({
        quantity: reservation.quantity,
        reserved_quantity: reservation.quantity
      });

    // Record in inventory history
    await dbConn('inventory_history').insert({
      product_id: reservation.product_id,
      type: 'SALE',
      quantity_change: -reservation.quantity,
      quantity_before: await dbConn('products').where('id', reservation.product_id).first('quantity').then(p => p.quantity + reservation.quantity),
      quantity_after: await dbConn('products').where('id', reservation.product_id).first('quantity').then(p => p.quantity),
      reference_id: reservation.reference_id,
      reference_type: reservation.reference_type
    });

    // Update stock status
    await this.updateStockStatus(reservation.product_id, dbConn);

    return {
      reservation_id: reservationId,
      product_id: reservation.product_id,
      quantity_fulfilled: reservation.quantity
    };
  }

  /**
   * Release expired reservations (cron job)
   */
  static async releaseExpiredReservations(trx = null) {
    const dbConn = trx || db;

    const expiredReservations = await dbConn('stock_reservations')
      .where('status', 'ACTIVE')
      .where('expires_at', '<', dbConn.fn.now())
      .select('id', 'product_id', 'quantity');

    for (const reservation of expiredReservations) {
      await dbConn('stock_reservations')
        .where('id', reservation.id)
        .update({
          status: 'EXPIRED',
          released_at: dbConn.fn.now()
        });

      await dbConn('products')
        .where('id', reservation.product_id)
        .decrement('reserved_quantity', reservation.quantity);

      await this.updateStockStatus(reservation.product_id, dbConn);
    }

    return {
      released_count: expiredReservations.length,
      reservations: expiredReservations
    };
  }

  /**
   * Check and create low stock alert
   */
  static async checkLowStockAlert(productId, currentQuantity, trx = null) {
    const dbConn = trx || db;

    const product = await dbConn('products')
      .where('id', productId)
      .first('low_stock_threshold', 'name');

    if (currentQuantity <= product.low_stock_threshold) {
      // Check if there's already a pending alert
      const existingAlert = await dbConn('low_stock_alerts')
        .where('product_id', productId)
        .where('status', 'PENDING')
        .first();

      if (!existingAlert) {
        await dbConn('low_stock_alerts').insert({
          product_id: productId,
          current_quantity: currentQuantity,
          threshold: product.low_stock_threshold,
          status: 'PENDING'
        });

        return { alert_created: true };
      }
    }

    return { alert_created: false };
  }

  /**
   * Update product stock status based on quantity
   */
  static async updateStockStatus(productId, trx = null) {
    const dbConn = trx || db;

    const product = await dbConn('products')
      .where('id', productId)
      .first('quantity', 'reserved_quantity', 'low_stock_threshold');

    const availableStock = product.quantity - product.reserved_quantity;
    let status;

    if (availableStock <= 0) {
      status = 'OUT_OF_STOCK';
    } else if (availableStock <= product.low_stock_threshold) {
      status = 'LOW_STOCK';
    } else {
      status = 'IN_STOCK';
    }

    await dbConn('products')
      .where('id', productId)
      .update({ stock_status: status });

    return { product_id: productId, stock_status: status };
  }

  /**
   * Get inventory history for a product
   */
  static async getInventoryHistory(productId, limit = 50, offset = 0) {
    const history = await db('inventory_history')
      .leftJoin('users', 'inventory_history.created_by', 'users.id')
      .where('inventory_history.product_id', productId)
      .select(
        'inventory_history.*',
        'users.name as created_by_name'
      )
      .orderBy('inventory_history.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await db('inventory_history')
      .where('product_id', productId)
      .count('* as count')
      .first();

    return {
      history,
      total: total.count,
      limit,
      offset
    };
  }

  /**
   * Get low stock alerts
   */
  static async getLowStockAlerts(status = 'PENDING', limit = 50, offset = 0) {
    const alerts = await db('low_stock_alerts')
      .leftJoin('products', 'low_stock_alerts.product_id', 'products.id')
      .leftJoin('users', 'low_stock_alerts.acknowledged_by', 'users.id')
      .where('low_stock_alerts.status', status)
      .select(
        'low_stock_alerts.*',
        'products.name as product_name',
        'products.sku',
        'users.name as acknowledged_by_name'
      )
      .orderBy('low_stock_alerts.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const total = await db('low_stock_alerts')
      .where('status', status)
      .count('* as count')
      .first();

    return {
      alerts,
      total: total.count,
      limit,
      offset
    };
  }

  /**
   * Acknowledge low stock alert
   */
  static async acknowledgeAlert(alertId, userId, notes = null, trx = null) {
    const dbConn = trx || db;

    await dbConn('low_stock_alerts')
      .where('id', alertId)
      .update({
        status: 'ACKNOWLEDGED',
        acknowledged_by: userId,
        acknowledged_at: dbConn.fn.now(),
        notes,
        updated_at: dbConn.fn.now()
      });

    return { alert_id: alertId, status: 'ACKNOWLEDGED' };
  }

  /**
   * Resolve low stock alert
   */
  static async resolveAlert(alertId, trx = null) {
    const dbConn = trx || db;

    await dbConn('low_stock_alerts')
      .where('id', alertId)
      .update({
        status: 'RESOLVED',
        resolved_at: dbConn.fn.now(),
        updated_at: dbConn.fn.now()
      });

    return { alert_id: alertId, status: 'RESOLVED' };
  }

  /**
   * Get product availability
   */
  static async getProductAvailability(productId) {
    const product = await db('products')
      .where('id', productId)
      .first('id', 'name', 'quantity', 'reserved_quantity', 'stock_status', 'track_inventory', 'low_stock_threshold');

    if (!product) {
      throw new Error('Product not found');
    }

    const availableStock = product.quantity - product.reserved_quantity;
    const activeReservations = await db('stock_reservations')
      .where('product_id', productId)
      .where('status', 'ACTIVE')
      .count('* as count')
      .first();

    return {
      product_id: productId,
      product_name: product.name,
      total_quantity: product.quantity,
      reserved_quantity: product.reserved_quantity,
      available_quantity: availableStock,
      stock_status: product.stock_status,
      track_inventory: product.track_inventory,
      low_stock_threshold: product.low_stock_threshold,
      active_reservations: activeReservations.count,
      is_available: availableStock > 0
    };
  }
}

module.exports = InventoryService;
