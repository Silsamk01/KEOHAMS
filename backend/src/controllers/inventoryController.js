const db = require('../config/db');
const InventoryService = require('../services/inventoryService');

class InventoryController {
  /**
   * Update product stock
   * POST /api/inventory/:productId/stock
   */
  static async updateStock(req, res) {
    const trx = await db.transaction();
    try {
      const { productId } = req.params;
      const { quantityChange, type, referenceId, referenceType, notes } = req.body;
      const userId = req.user.id;

      if (quantityChange === undefined) {
        return res.status(400).json({ error: 'Quantity change is required' });
      }

      if (!type) {
        return res.status(400).json({ error: 'Type is required (PURCHASE, SALE, RETURN, DAMAGE, ADJUSTMENT, etc.)' });
      }

      const result = await InventoryService.updateStock(
        productId,
        parseInt(quantityChange),
        type,
        referenceId,
        referenceType,
        notes,
        userId,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Stock updated successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Update stock error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Reserve stock for cart/checkout
   * POST /api/inventory/:productId/reserve
   */
  static async reserveStock(req, res) {
    const trx = await db.transaction();
    try {
      const { productId } = req.params;
      const { quantity, type, referenceId, referenceType, expiryMinutes } = req.body;
      const userId = req.user.id;

      if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Valid quantity is required' });
      }

      const result = await InventoryService.reserveStock(
        productId,
        parseInt(quantity),
        userId,
        type || 'CART',
        referenceId,
        referenceType,
        expiryMinutes || 30,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Stock reserved successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Reserve stock error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Release stock reservation
   * POST /api/inventory/reservations/:reservationId/release
   */
  static async releaseReservation(req, res) {
    const trx = await db.transaction();
    try {
      const { reservationId } = req.params;

      const result = await InventoryService.releaseReservation(reservationId, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Reservation released successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Release reservation error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Fulfill reservation (convert to order)
   * POST /api/inventory/reservations/:reservationId/fulfill
   */
  static async fulfillReservation(req, res) {
    const trx = await db.transaction();
    try {
      const { reservationId } = req.params;

      const result = await InventoryService.fulfillReservation(reservationId, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Reservation fulfilled successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Fulfill reservation error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get inventory history
   * GET /api/inventory/:productId/history
   */
  static async getInventoryHistory(req, res) {
    try {
      const { productId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await InventoryService.getInventoryHistory(
        productId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get inventory history error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get product availability
   * GET /api/inventory/:productId/availability
   */
  static async getProductAvailability(req, res) {
    try {
      const { productId } = req.params;

      const result = await InventoryService.getProductAvailability(productId);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get product availability error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get low stock alerts (admin only)
   * GET /api/inventory/alerts/low-stock
   */
  static async getLowStockAlerts(req, res) {
    try {
      const { status = 'PENDING', limit = 50, offset = 0 } = req.query;

      const result = await InventoryService.getLowStockAlerts(
        status,
        parseInt(limit),
        parseInt(offset)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get low stock alerts error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Acknowledge low stock alert (admin only)
   * PUT /api/inventory/alerts/:alertId/acknowledge
   */
  static async acknowledgeAlert(req, res) {
    const trx = await db.transaction();
    try {
      const { alertId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      const result = await InventoryService.acknowledgeAlert(alertId, userId, notes, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Acknowledge alert error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Resolve low stock alert (admin only)
   * PUT /api/inventory/alerts/:alertId/resolve
   */
  static async resolveAlert(req, res) {
    const trx = await db.transaction();
    try {
      const { alertId } = req.params;

      const result = await InventoryService.resolveAlert(alertId, trx);

      await trx.commit();
      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Resolve alert error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Bulk update product inventory settings (admin only)
   * PUT /api/inventory/:productId/settings
   */
  static async updateInventorySettings(req, res) {
    const trx = await db.transaction();
    try {
      const { productId } = req.params;
      const { trackInventory, lowStockThreshold, reorderPoint, reorderQuantity, sku, barcode } = req.body;

      const updates = {};
      if (trackInventory !== undefined) updates.track_inventory = trackInventory;
      if (lowStockThreshold !== undefined) updates.low_stock_threshold = parseInt(lowStockThreshold);
      if (reorderPoint !== undefined) updates.reorder_point = parseInt(reorderPoint);
      if (reorderQuantity !== undefined) updates.reorder_quantity = parseInt(reorderQuantity);
      if (sku !== undefined) updates.sku = sku;
      if (barcode !== undefined) updates.barcode = barcode;

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updates.updated_at = trx.fn.now();

      await trx('products')
        .where('id', productId)
        .update(updates);

      await trx.commit();
      res.json({
        success: true,
        message: 'Inventory settings updated successfully',
        data: { product_id: productId, updates }
      });
    } catch (error) {
      await trx.rollback();
      console.error('Update inventory settings error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Release expired reservations (cron job endpoint)
   * POST /api/inventory/reservations/release-expired
   */
  static async releaseExpiredReservations(req, res) {
    const trx = await db.transaction();
    try {
      const result = await InventoryService.releaseExpiredReservations(trx);

      await trx.commit();
      res.json({
        success: true,
        message: `Released ${result.released_count} expired reservations`,
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Release expired reservations error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = InventoryController;
