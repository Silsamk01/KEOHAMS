const db = require('../config/db');
const OrderManagementService = require('../services/orderManagementService');

class OrderManagementController {
  /**
   * Update order status
   * POST /api/orders/:orderId/status
   */
  static async updateOrderStatus(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.id;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const result = await OrderManagementService.updateOrderStatus(
        orderId,
        status,
        userId,
        notes,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Order status updated successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Update order status error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Ship entire order
   * POST /api/orders/:orderId/ship
   */
  static async shipOrder(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { carrier, trackingNumber, estimatedDelivery, shippingAddress } = req.body;
      const userId = req.user.id;

      if (!carrier || !trackingNumber) {
        return res.status(400).json({ error: 'Carrier and tracking number are required' });
      }

      const result = await OrderManagementService.shipOrder(
        orderId,
        {
          carrier,
          tracking_number: trackingNumber,
          estimated_delivery: estimatedDelivery,
          shipping_address: shippingAddress
        },
        userId,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Order shipped successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Ship order error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Create split shipment
   * POST /api/orders/:orderId/shipments
   */
  static async createShipment(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { items, carrier, trackingNumber, estimatedDelivery, notes } = req.body;
      const userId = req.user.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      if (!carrier || !trackingNumber) {
        return res.status(400).json({ error: 'Carrier and tracking number are required' });
      }

      const shipment = await OrderManagementService.createShipment(
        orderId,
        items,
        {
          carrier,
          tracking_number: trackingNumber,
          estimated_delivery: estimatedDelivery,
          notes
        },
        userId,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Shipment created successfully',
        data: shipment
      });
    } catch (error) {
      await trx.rollback();
      console.error('Create shipment error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order shipments
   * GET /api/orders/:orderId/shipments
   */
  static async getOrderShipments(req, res) {
    try {
      const { orderId } = req.params;

      const shipments = await db('order_shipments')
        .where('order_id', orderId)
        .orderBy('created_at', 'desc');

      res.json({
        success: true,
        data: shipments
      });
    } catch (error) {
      console.error('Get shipments error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Update item fulfillment status
   * PUT /api/orders/:orderId/items/:itemId/fulfillment
   */
  static async updateItemFulfillment(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId, itemId } = req.params;
      const { quantityShipped, quantityCancelled, quantityReturned, fulfillmentStatus } = req.body;

      const result = await OrderManagementService.updateItemFulfillment(
        itemId,
        {
          quantity_shipped: quantityShipped,
          quantity_cancelled: quantityCancelled,
          quantity_returned: quantityReturned,
          fulfillment_status: fulfillmentStatus
        },
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Item fulfillment updated successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Update item fulfillment error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Cancel order
   * POST /api/orders/:orderId/cancel
   */
  static async cancelOrder(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      const userId = req.user.id;

      const result = await OrderManagementService.cancelOrder(
        orderId,
        userId,
        reason,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Order cancelled successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Cancel order error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Create return request
   * POST /api/orders/:orderId/returns
   */
  static async createReturn(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { items, reason, requestType, comments } = req.body;
      const userId = req.user.id;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      if (!reason) {
        return res.status(400).json({ error: 'Return reason is required' });
      }

      const returnRequest = await OrderManagementService.createReturn(
        orderId,
        userId,
        items,
        reason,
        requestType || 'REFUND',
        comments,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Return request created successfully',
        data: returnRequest
      });
    } catch (error) {
      await trx.rollback();
      console.error('Create return error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Process return (admin only)
   * PUT /api/orders/returns/:returnId/process
   */
  static async processReturn(req, res) {
    const trx = await db.transaction();
    try {
      const { returnId } = req.params;
      const { action, refundAmount, restockItems, adminNotes } = req.body;
      const userId = req.user.id;

      if (!action || !['APPROVE', 'REJECT', 'COMPLETE'].includes(action)) {
        return res.status(400).json({ error: 'Valid action is required (APPROVE, REJECT, COMPLETE)' });
      }

      const result = await OrderManagementService.processReturn(
        returnId,
        action,
        userId,
        {
          refund_amount: refundAmount,
          restock_items: restockItems,
          admin_notes: adminNotes
        },
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Return processed successfully',
        data: result
      });
    } catch (error) {
      await trx.rollback();
      console.error('Process return error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order returns
   * GET /api/orders/:orderId/returns
   */
  static async getOrderReturns(req, res) {
    try {
      const { orderId } = req.params;

      const returns = await db('order_returns')
        .where('order_id', orderId)
        .orderBy('created_at', 'desc');

      res.json({
        success: true,
        data: returns
      });
    } catch (error) {
      console.error('Get returns error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Add order note
   * POST /api/orders/:orderId/notes
   */
  static async addNote(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { note, isCustomerVisible } = req.body;
      const userId = req.user.id;

      if (!note) {
        return res.status(400).json({ error: 'Note content is required' });
      }

      const noteRecord = await OrderManagementService.addNote(
        orderId,
        userId,
        note,
        isCustomerVisible || false,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Note added successfully',
        data: noteRecord
      });
    } catch (error) {
      await trx.rollback();
      console.error('Add note error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order notes
   * GET /api/orders/:orderId/notes
   */
  static async getOrderNotes(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      let query = db('order_notes')
        .leftJoin('users', 'order_notes.created_by', 'users.id')
        .where('order_notes.order_id', orderId)
        .select(
          'order_notes.*',
          'users.name as created_by_name',
          'users.email as created_by_email'
        );

      // Non-admin users only see customer-visible notes
      if (!isAdmin) {
        query = query.where('order_notes.is_customer_visible', true);
      }

      const notes = await query.orderBy('order_notes.created_at', 'desc');

      res.json({
        success: true,
        data: notes
      });
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order status history
   * GET /api/orders/:orderId/history
   */
  static async getStatusHistory(req, res) {
    try {
      const { orderId } = req.params;

      const history = await OrderManagementService.getStatusHistory(orderId);

      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('Get status history error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order fulfillment summary
   * GET /api/orders/:orderId/fulfillment
   */
  static async getFulfillmentSummary(req, res) {
    try {
      const { orderId } = req.params;

      const summary = await OrderManagementService.getFulfillmentSummary(orderId);

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Get fulfillment summary error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Generate invoice
   * POST /api/orders/:orderId/invoices
   */
  static async generateInvoice(req, res) {
    const trx = await db.transaction();
    try {
      const { orderId } = req.params;
      const { type, pdfUrl } = req.body;
      const userId = req.user.id;

      const invoiceType = type || 'INVOICE';
      if (!['INVOICE', 'RECEIPT', 'CREDIT_NOTE'].includes(invoiceType)) {
        return res.status(400).json({ error: 'Invalid invoice type' });
      }

      const invoice = await OrderManagementService.generateInvoice(
        orderId,
        invoiceType,
        userId,
        pdfUrl,
        trx
      );

      await trx.commit();
      res.json({
        success: true,
        message: 'Invoice generated successfully',
        data: invoice
      });
    } catch (error) {
      await trx.rollback();
      console.error('Generate invoice error:', error);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get order invoices
   * GET /api/orders/:orderId/invoices
   */
  static async getOrderInvoices(req, res) {
    try {
      const { orderId } = req.params;

      const invoices = await db('order_invoices')
        .leftJoin('users', 'order_invoices.generated_by', 'users.id')
        .where('order_invoices.order_id', orderId)
        .select(
          'order_invoices.*',
          'users.name as generated_by_name'
        )
        .orderBy('order_invoices.created_at', 'desc');

      res.json({
        success: true,
        data: invoices
      });
    } catch (error) {
      console.error('Get invoices error:', error);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = OrderManagementController;
