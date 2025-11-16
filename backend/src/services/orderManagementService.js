/**
 * Order Management Service
 * Handles order lifecycle, status transitions, shipping, and returns
 */

const db = require('../config/db');

class OrderManagementService {
  
  /**
   * Create order status history entry
   */
  static async addStatusHistory(order_id, from_status, to_status, changed_by, changed_by_type = 'SYSTEM', notes = null) {
    return await db('order_status_history').insert({
      order_id,
      from_status,
      to_status,
      changed_by,
      changed_by_type,
      notes,
      metadata: JSON.stringify({ timestamp: new Date().toISOString() })
    });
  }

  /**
   * Update order status with history tracking
   */
  static async updateOrderStatus(order_id, new_status, changed_by, changed_by_type = 'SYSTEM', notes = null) {
    const trx = await db.transaction();
    
    try {
      // Get current order
      const order = await trx('orders').where('id', order_id).first();
      if (!order) {
        throw new Error('Order not found');
      }

      const old_status = order.status;

      // Update order status
      const updateData = { status: new_status };
      
      // Add timestamps for specific statuses
      if (new_status === 'SHIPPED' && !order.shipped_at) {
        updateData.shipped_at = new Date();
      }
      if (new_status === 'DELIVERED' && !order.delivered_at) {
        updateData.delivered_at = new Date();
      }
      if (new_status === 'CANCELLED' && !order.cancelled_at) {
        updateData.cancelled_at = new Date();
        updateData.cancelled_by = changed_by;
      }

      await trx('orders').where('id', order_id).update(updateData);

      // Add status history
      await trx('order_status_history').insert({
        order_id,
        from_status: old_status,
        to_status: new_status,
        changed_by,
        changed_by_type,
        notes
      });

      await trx.commit();

      return { success: true, old_status, new_status };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Add shipping information to order
   */
  static async addShippingInfo(order_id, shipping_data) {
    const { tracking_number, carrier, estimated_delivery_date, shipping_method } = shipping_data;
    
    await db('orders')
      .where('id', order_id)
      .update({
        tracking_number,
        carrier,
        estimated_delivery_date,
        shipping_method
      });

    return { success: true };
  }

  /**
   * Create shipment for order
   */
  static async createShipment(shipment_data) {
    const {
      order_id,
      tracking_number,
      carrier,
      weight,
      dimensions,
      items,
      notes
    } = shipment_data;

    // Generate shipment reference
    const reference = `SHIP-${Date.now()}-${order_id}`.toUpperCase();

    const [shipment_id] = await db('order_shipments').insert({
      order_id,
      shipment_reference: reference,
      status: 'PREPARING',
      tracking_number,
      carrier,
      weight,
      dimensions: JSON.stringify(dimensions),
      items: JSON.stringify(items),
      notes
    });

    // Update order items fulfillment status
    for (const item of items) {
      await this.updateItemFulfillment(item.order_item_id, item.quantity);
    }

    return { success: true, shipment_id, reference };
  }

  /**
   * Update item fulfillment
   */
  static async updateItemFulfillment(order_item_id, quantity_shipped) {
    const item = await db('order_items').where('id', order_item_id).first();
    if (!item) {
      throw new Error('Order item not found');
    }

    const new_quantity_shipped = item.quantity_shipped + quantity_shipped;
    const total_fulfilled = new_quantity_shipped + item.quantity_cancelled + item.quantity_returned;
    
    let fulfillment_status = 'PENDING';
    if (total_fulfilled >= item.quantity) {
      fulfillment_status = 'FULFILLED';
    } else if (new_quantity_shipped > 0) {
      fulfillment_status = 'PARTIALLY_FULFILLED';
    }

    await db('order_items')
      .where('id', order_item_id)
      .update({
        quantity_shipped: new_quantity_shipped,
        fulfillment_status
      });

    return { success: true };
  }

  /**
   * Ship entire order
   */
  static async shipOrder(order_id, shipping_data, changed_by, changed_by_type = 'ADMIN') {
    const trx = await db.transaction();
    
    try {
      // Get order and items
      const order = await trx('orders').where('id', order_id).first();
      if (!order) {
        throw new Error('Order not found');
      }

      const items = await trx('order_items').where('order_id', order_id);

      // Update order
      await trx('orders')
        .where('id', order_id)
        .update({
          status: 'SHIPPED',
          tracking_number: shipping_data.tracking_number,
          carrier: shipping_data.carrier,
          estimated_delivery_date: shipping_data.estimated_delivery_date,
          shipped_at: new Date()
        });

      // Create shipment record
      const shipment_reference = `SHIP-${Date.now()}-${order_id}`.toUpperCase();
      const shipment_items = items.map(item => ({
        order_item_id: item.id,
        product_id: item.product_id,
        quantity: item.quantity
      }));

      await trx('order_shipments').insert({
        order_id,
        shipment_reference,
        status: 'SHIPPED',
        tracking_number: shipping_data.tracking_number,
        carrier: shipping_data.carrier,
        items: JSON.stringify(shipment_items),
        shipped_at: new Date()
      });

      // Update all items to shipped
      await trx('order_items')
        .where('order_id', order_id)
        .update({
          quantity_shipped: trx.raw('quantity'),
          fulfillment_status: 'FULFILLED'
        });

      // Add status history
      await trx('order_status_history').insert({
        order_id,
        from_status: order.status,
        to_status: 'SHIPPED',
        changed_by,
        changed_by_type,
        notes: `Shipped via ${shipping_data.carrier}. Tracking: ${shipping_data.tracking_number}`
      });

      await trx.commit();

      return { success: true, shipment_reference };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Mark order as delivered
   */
  static async markDelivered(order_id, changed_by, changed_by_type = 'ADMIN', notes = null) {
    return await this.updateOrderStatus(order_id, 'DELIVERED', changed_by, changed_by_type, notes);
  }

  /**
   * Cancel order
   */
  static async cancelOrder(order_id, reason, cancelled_by, cancelled_by_type = 'CUSTOMER') {
    const trx = await db.transaction();
    
    try {
      const order = await trx('orders').where('id', order_id).first();
      if (!order) {
        throw new Error('Order not found');
      }

      // Check if order can be cancelled
      const non_cancellable_statuses = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
      if (non_cancellable_statuses.includes(order.status)) {
        throw new Error(`Cannot cancel order with status: ${order.status}`);
      }

      // Update order
      await trx('orders')
        .where('id', order_id)
        .update({
          status: 'CANCELLED',
          cancellation_reason: reason,
          cancelled_at: new Date(),
          cancelled_by
        });

      // Update all items
      await trx('order_items')
        .where('order_id', order_id)
        .update({
          quantity_cancelled: trx.raw('quantity - quantity_shipped'),
          fulfillment_status: 'CANCELLED'
        });

      // Add status history
      await trx('order_status_history').insert({
        order_id,
        from_status: order.status,
        to_status: 'CANCELLED',
        changed_by: cancelled_by,
        changed_by_type: cancelled_by_type,
        notes: `Cancelled: ${reason}`
      });

      await trx.commit();

      return { success: true };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Create return request
   */
  static async createReturn(return_data) {
    const {
      order_id,
      user_id,
      type,
      reason,
      description,
      items,
      images = []
    } = return_data;

    const trx = await db.transaction();
    
    try {
      // Verify order belongs to user
      const order = await trx('orders').where({ id: order_id, user_id }).first();
      if (!order) {
        throw new Error('Order not found or does not belong to you');
      }

      // Generate return reference
      const reference = `RET-${Date.now()}-${order_id}`.toUpperCase();

      // Create return
      const [return_id] = await trx('order_returns').insert({
        order_id,
        user_id,
        return_reference: reference,
        type,
        reason,
        description,
        items: JSON.stringify(items),
        images: JSON.stringify(images),
        status: 'REQUESTED'
      });

      await trx.commit();

      return { success: true, return_id, reference };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Process return (admin)
   */
  static async processReturn(return_id, action, processed_by, notes = null) {
    const trx = await db.transaction();
    
    try {
      const return_request = await trx('order_returns').where('id', return_id).first();
      if (!return_request) {
        throw new Error('Return request not found');
      }

      const updateData = {
        processed_by,
        admin_notes: notes
      };

      if (action === 'approve') {
        updateData.status = 'APPROVED';
        updateData.approved_at = new Date();
      } else if (action === 'reject') {
        updateData.status = 'REJECTED';
        updateData.rejection_reason = notes;
      } else if (action === 'complete') {
        updateData.status = 'COMPLETED';
        updateData.completed_at = new Date();

        // Update order items
        const items = JSON.parse(return_request.items);
        for (const item of items) {
          await trx('order_items')
            .where('id', item.order_item_id)
            .increment('quantity_returned', item.quantity);
        }
      }

      await trx('order_returns').where('id', return_id).update(updateData);

      await trx.commit();

      return { success: true };
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Add order note
   */
  static async addNote(order_id, note, created_by, customer_visible = false) {
    const [note_id] = await db('order_notes').insert({
      order_id,
      created_by,
      note,
      customer_visible
    });

    return { success: true, note_id };
  }

  /**
   * Get order status history
   */
  static async getStatusHistory(order_id) {
    return await db('order_status_history')
      .where('order_id', order_id)
      .leftJoin('users', 'order_status_history.changed_by', 'users.id')
      .select(
        'order_status_history.*',
        'users.name as changed_by_name',
        'users.email as changed_by_email'
      )
      .orderBy('order_status_history.created_at', 'desc');
  }

  /**
   * Get order shipments
   */
  static async getShipments(order_id) {
    return await db('order_shipments')
      .where('order_id', order_id)
      .orderBy('created_at', 'desc');
  }

  /**
   * Get order notes
   */
  static async getNotes(order_id, customer_visible_only = false) {
    let query = db('order_notes')
      .where('order_id', order_id)
      .leftJoin('users', 'order_notes.created_by', 'users.id')
      .select(
        'order_notes.*',
        'users.name as created_by_name'
      )
      .orderBy('order_notes.created_at', 'desc');

    if (customer_visible_only) {
      query = query.where('order_notes.customer_visible', true);
    }

    return await query;
  }

  /**
   * Get order fulfillment summary
   */
  static async getFulfillmentSummary(order_id) {
    const items = await db('order_items')
      .where('order_id', order_id)
      .select('*');

    const summary = {
      total_items: items.length,
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      quantity_shipped: items.reduce((sum, item) => sum + item.quantity_shipped, 0),
      quantity_cancelled: items.reduce((sum, item) => sum + item.quantity_cancelled, 0),
      quantity_returned: items.reduce((sum, item) => sum + item.quantity_returned, 0),
      fully_fulfilled: items.every(item => item.fulfillment_status === 'FULFILLED'),
      partially_fulfilled: items.some(item => item.fulfillment_status === 'PARTIALLY_FULFILLED')
    };

    summary.quantity_pending = summary.total_quantity - summary.quantity_shipped - summary.quantity_cancelled;

    return summary;
  }
}

module.exports = OrderManagementService;
