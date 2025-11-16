const db = require('../config/db');
const crypto = require('crypto');

class EmailMarketingService {
  /**
   * Track abandoned cart
   */
  static async trackAbandonedCart(userId, sessionId, email, cartItems, cartValue, trx = null) {
    const dbConn = trx || db;

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const [cartId] = await dbConn('abandoned_carts').insert({
      user_id: userId,
      session_id: sessionId,
      email,
      cart_items: JSON.stringify(cartItems),
      cart_value: cartValue,
      item_count: itemCount,
      recovery_status: 'ABANDONED',
      abandoned_at: dbConn.fn.now()
    });

    return { abandoned_cart_id: cartId };
  }

  /**
   * Send abandoned cart reminder
   */
  static async sendAbandonedCartReminder(abandonedCartId, reminderNumber, trx = null) {
    const dbConn = trx || db;

    const cart = await dbConn('abandoned_carts')
      .where('id', abandonedCartId)
      .first();

    if (!cart) {
      throw new Error('Abandoned cart not found');
    }

    const updateField = `${['first', 'second', 'third'][reminderNumber - 1]}_reminder_at`;
    const newStatus = `REMINDED_${reminderNumber}`;

    await dbConn('abandoned_carts')
      .where('id', abandonedCartId)
      .update({
        recovery_status: newStatus,
        [updateField]: dbConn.fn.now()
      });

    // Log email send (would integrate with actual email service)
    const trackingId = crypto.randomBytes(16).toString('hex');
    await dbConn('email_logs').insert({
      user_id: cart.user_id,
      email: cart.email,
      subject: `Your cart is waiting - ${cart.item_count} items`,
      status: 'SENT',
      tracking_id: trackingId,
      sent_at: dbConn.fn.now()
    });

    return { abandoned_cart_id: abandonedCartId, reminder_number: reminderNumber };
  }

  /**
   * Mark cart as recovered
   */
  static async markCartRecovered(sessionId, orderId, trx = null) {
    const dbConn = trx || db;

    await dbConn('abandoned_carts')
      .where('session_id', sessionId)
      .whereIn('recovery_status', ['ABANDONED', 'REMINDED_1', 'REMINDED_2', 'REMINDED_3'])
      .update({
        recovery_status: 'RECOVERED',
        recovered_at: dbConn.fn.now(),
        recovered_order_id: orderId
      });

    return { session_id: sessionId, order_id: orderId };
  }

  /**
   * Get abandoned carts pending reminder
   */
  static async getAbandonedCartsPendingReminder(hoursThreshold = 1) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursThreshold);

    return await db('abandoned_carts')
      .where('recovery_status', 'ABANDONED')
      .where('abandoned_at', '<', cutoffTime)
      .select('*');
  }

  /**
   * Create email campaign
   */
  static async createCampaign(data, userId, trx = null) {
    const dbConn = trx || db;

    const [campaignId] = await dbConn('email_campaigns').insert({
      name: data.name,
      subject: data.subject,
      content: data.content,
      type: data.type,
      status: data.status || 'DRAFT',
      audience_filter: JSON.stringify(data.audienceFilter || {}),
      scheduled_at: data.scheduledAt || null,
      created_by: userId
    });

    return { campaign_id: campaignId };
  }

  /**
   * Get campaign stats
   */
  static async getCampaignStats(campaignId) {
    const campaign = await db('email_campaigns')
      .where('id', campaignId)
      .first();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const openRate = campaign.sent_count > 0
      ? ((campaign.opened_count / campaign.sent_count) * 100).toFixed(2)
      : 0;

    const clickRate = campaign.sent_count > 0
      ? ((campaign.clicked_count / campaign.sent_count) * 100).toFixed(2)
      : 0;

    const conversionRate = campaign.sent_count > 0
      ? ((campaign.converted_count / campaign.sent_count) * 100).toFixed(2)
      : 0;

    return {
      ...campaign,
      open_rate: openRate,
      click_rate: clickRate,
      conversion_rate: conversionRate
    };
  }

  /**
   * Track email open
   */
  static async trackEmailOpen(trackingId, trx = null) {
    const dbConn = trx || db;

    const log = await dbConn('email_logs')
      .where('tracking_id', trackingId)
      .first();

    if (!log) {
      return { tracked: false };
    }

    // Only count first open
    if (!log.opened_at) {
      await dbConn('email_logs')
        .where('id', log.id)
        .update({
          status: 'OPENED',
          opened_at: dbConn.fn.now()
        });

      // Update campaign stats
      if (log.campaign_id) {
        await dbConn('email_campaigns')
          .where('id', log.campaign_id)
          .increment('opened_count', 1);
      }
    }

    return { tracked: true };
  }

  /**
   * Track email click
   */
  static async trackEmailClick(trackingId, trx = null) {
    const dbConn = trx || db;

    const log = await dbConn('email_logs')
      .where('tracking_id', trackingId)
      .first();

    if (!log) {
      return { tracked: false };
    }

    // Only count first click
    if (!log.clicked_at) {
      await dbConn('email_logs')
        .where('id', log.id)
        .update({
          status: 'CLICKED',
          clicked_at: dbConn.fn.now()
        });

      // Update campaign stats
      if (log.campaign_id) {
        await dbConn('email_campaigns')
          .where('id', log.campaign_id)
          .increment('clicked_count', 1);
      }
    }

    return { tracked: true };
  }
}

module.exports = EmailMarketingService;
