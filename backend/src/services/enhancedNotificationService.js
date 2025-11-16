const db = require('../config/db');
const { sendMail } = require('../utils/email');

class EnhancedNotificationService {
  /**
   * Create notification with multi-channel support
   */
  static async createNotification(userId, type, title, message, priority = 'MEDIUM', actionUrl = null, metadata = {}) {
    // Get user preferences
    const preferences = await this.getUserPreferences(userId, type);

    const notifications = [];

    // In-app notification (always create)
    if (preferences.in_app_enabled) {
      const [notificationId] = await db('notifications').insert({
        user_id: userId,
        type,
        title,
        message,
        priority,
        channel: 'IN_APP',
        action_url: actionUrl,
        metadata: JSON.stringify(metadata)
      });
      notifications.push({ channel: 'IN_APP', id: notificationId });
    }

    // Email notification
    if (preferences.email_enabled) {
      await this.sendEmailNotification(userId, type, title, message, actionUrl);
      notifications.push({ channel: 'EMAIL', status: 'sent' });
    }

    // SMS notification
    if (preferences.sms_enabled) {
      await this.sendSmsNotification(userId, message);
      notifications.push({ channel: 'SMS', status: 'queued' });
    }

    // Push notification (web push, could be extended to mobile)
    if (preferences.push_enabled) {
      // Emit socket event for real-time notification
      const io = require('../sockets/socketManager').getIO();
      if (io) {
        io.to(`user_${userId}`).emit('notification', {
          type,
          title,
          message,
          priority,
          action_url: actionUrl,
          created_at: new Date()
        });
      }
      notifications.push({ channel: 'PUSH', status: 'sent' });
    }

    return notifications;
  }

  /**
   * Get user notification preferences
   */
  static async getUserPreferences(userId, notificationType) {
    let prefs = await db('notification_preferences')
      .where('user_id', userId)
      .where('notification_type', notificationType)
      .first();

    if (!prefs) {
      // Create default preferences
      await db('notification_preferences').insert({
        user_id: userId,
        notification_type: notificationType,
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true
      });

      prefs = {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true
      };
    }

    return prefs;
  }

  /**
   * Update user notification preferences
   */
  static async updatePreferences(userId, notificationType, preferences) {
    const existing = await db('notification_preferences')
      .where('user_id', userId)
      .where('notification_type', notificationType)
      .first();

    const updates = {
      email_enabled: preferences.email_enabled,
      sms_enabled: preferences.sms_enabled,
      push_enabled: preferences.push_enabled,
      in_app_enabled: preferences.in_app_enabled,
      updated_at: db.fn.now()
    };

    // Remove undefined values
    Object.keys(updates).forEach(key => 
      updates[key] === undefined && delete updates[key]
    );

    if (existing) {
      await db('notification_preferences')
        .where('id', existing.id)
        .update(updates);
    } else {
      await db('notification_preferences').insert({
        user_id: userId,
        notification_type: notificationType,
        ...updates
      });
    }

    return await db('notification_preferences')
      .where('user_id', userId)
      .where('notification_type', notificationType)
      .first();
  }

  /**
   * Get all user preferences
   */
  static async getAllUserPreferences(userId) {
    const notificationTypes = [
      'ORDER_UPDATE',
      'PAYMENT_CONFIRMATION',
      'SHIPPING_UPDATE',
      'PRICE_DROP',
      'PRODUCT_RESTOCK',
      'SUPPORT_REPLY',
      'MARKETING',
      'NEWSLETTER',
      'REVIEW_REPLY',
      'WISHLIST_ALERT',
      'AFFILIATE_COMMISSION'
    ];

    const preferences = await db('notification_preferences')
      .where('user_id', userId);

    // Fill in missing types with defaults
    const result = {};
    for (const type of notificationTypes) {
      const pref = preferences.find(p => p.notification_type === type);
      result[type] = pref || {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true
      };
    }

    return result;
  }

  /**
   * Send email notification
   */
  static async sendEmailNotification(userId, type, title, message, actionUrl) {
    const user = await db('users').where('id', userId).first();
    if (!user || !user.email) return;

    try {
      let html = `
        <h2>${title}</h2>
        <p>${message}</p>
      `;

      if (actionUrl) {
        html += `<p><a href="${actionUrl}" style="display:inline-block;padding:10px 20px;background:#007bff;color:white;text-decoration:none;border-radius:5px;">View Details</a></p>`;
      }

      await sendMail({
        to: user.email,
        subject: title,
        html
      });
    } catch (error) {
      console.error('Email notification failed:', error);
    }
  }

  /**
   * Send SMS notification
   */
  static async sendSmsNotification(userId, message) {
    const user = await db('users').where('id', userId).first();
    if (!user || !user.phone || !user.phone_verified) {
      return;
    }

    try {
      // Log SMS (actual sending would use Twilio/Termii API)
      const [smsId] = await db('sms_logs').insert({
        user_id: userId,
        phone_number: user.phone,
        message: message.substring(0, 160), // SMS limit
        status: 'PENDING',
        provider: process.env.SMS_PROVIDER || 'TWILIO'
      });

      // In production, integrate with SMS provider:
      // await this.sendViaTwilio(user.phone, message);
      // await this.sendViaTermii(user.phone, message);

      // For now, mark as sent
      await db('sms_logs')
        .where('id', smsId)
        .update({
          status: 'SENT',
          sent_at: db.fn.now()
        });

      return smsId;
    } catch (error) {
      console.error('SMS notification failed:', error);
      await db('sms_logs')
        .where('user_id', userId)
        .orderBy('id', 'desc')
        .limit(1)
        .update({
          status: 'FAILED',
          error_message: error.message
        });
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const notification = await db('notifications')
      .where('id', notificationId)
      .where('user_id', userId)
      .first();

    if (!notification) {
      throw new Error('Notification not found');
    }

    await db('notifications')
      .where('id', notificationId)
      .update({
        read: true,
        read_at: db.fn.now()
      });

    return true;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(userId) {
    await db('notifications')
      .where('user_id', userId)
      .where('read', false)
      .update({
        read: true,
        read_at: db.fn.now()
      });

    return true;
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(userId) {
    const result = await db('notifications')
      .where('user_id', userId)
      .where('read', false)
      .count('* as count')
      .first();

    return result.count || 0;
  }

  /**
   * Delete notification
   */
  static async deleteNotification(notificationId, userId) {
    const deleted = await db('notifications')
      .where('id', notificationId)
      .where('user_id', userId)
      .delete();

    return deleted > 0;
  }

  /**
   * Bulk notification (admin feature)
   */
  static async sendBulkNotification(userIds, type, title, message, priority = 'MEDIUM') {
    const results = [];

    for (const userId of userIds) {
      try {
        const notifications = await this.createNotification(
          userId,
          type,
          title,
          message,
          priority
        );
        results.push({ user_id: userId, status: 'sent', notifications });
      } catch (error) {
        results.push({ user_id: userId, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  /**
   * Create notification template
   */
  static async createTemplate(templateKey, name, channel, subject, bodyTemplate) {
    const [templateId] = await db('notification_templates').insert({
      template_key: templateKey,
      name,
      channel,
      subject,
      body_template: bodyTemplate,
      is_active: true
    });

    return await db('notification_templates').where('id', templateId).first();
  }

  /**
   * Render template with variables
   */
  static renderTemplate(template, variables) {
    let rendered = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, value);
    }
    return rendered;
  }

  /**
   * Send notification from template
   */
  static async sendFromTemplate(userId, templateKey, variables) {
    const template = await db('notification_templates')
      .where('template_key', templateKey)
      .where('is_active', true)
      .first();

    if (!template) {
      throw new Error('Template not found');
    }

    const subject = this.renderTemplate(template.subject || '', variables);
    const message = this.renderTemplate(template.body_template, variables);

    if (template.channel === 'EMAIL') {
      return await this.sendEmailNotification(userId, 'MARKETING', subject, message, null);
    } else if (template.channel === 'SMS') {
      return await this.sendSmsNotification(userId, message);
    } else {
      return await this.createNotification(userId, 'MARKETING', subject, message);
    }
  }
}

module.exports = EnhancedNotificationService;
