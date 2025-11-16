const db = require('../config/db');
const { sendMail } = require('../utils/email');
const crypto = require('crypto');

// Public subscription endpoint
exports.subscribe = async (req, res) => {
  const { email, name, source } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }
  
  try {
    // Check if already subscribed
    const existing = await db('newsletter_subscribers')
      .where({ email: email.toLowerCase() })
      .first();
    
    if (existing) {
      if (existing.status === 'ACTIVE') {
        return res.json({ message: 'You are already subscribed to our newsletter' });
      } else {
        // Reactivate subscription
        await db('newsletter_subscribers')
          .where({ id: existing.id })
          .update({
            status: 'ACTIVE',
            name: name || existing.name,
            subscribed_at: db.fn.now(),
            unsubscribed_at: null
          });
        return res.json({ message: 'Your subscription has been reactivated' });
      }
    }
    
    // Create new subscription
    const token = crypto.randomBytes(32).toString('hex');
    await db('newsletter_subscribers').insert({
      email: email.toLowerCase(),
      name: name || null,
      status: 'ACTIVE',
      subscription_token: token,
      source: source || 'website',
      subscribed_at: db.fn.now()
    });
    
    // Send welcome email
    try {
      await sendMail({
        to: email,
        subject: 'Welcome to KEOHAMS Newsletter',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2f5337;">Welcome to KEOHAMS Newsletter!</h2>
            <p>Hello ${name || 'there'},</p>
            <p>Thank you for subscribing to our newsletter. You'll now receive updates about our latest products, insights, and exclusive offers.</p>
            <p>If you wish to unsubscribe at any time, click <a href="${process.env.APP_URL}/unsubscribe?token=${token}">here</a>.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">© ${new Date().getFullYear()} KEOHAMS. All rights reserved.</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue even if email fails
    }
    
    res.json({ message: 'Successfully subscribed to newsletter' });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({ message: 'Failed to subscribe' });
  }
};

// Public unsubscribe endpoint
exports.unsubscribe = async (req, res) => {
  const { token, email } = req.query;
  
  try {
    let subscriber;
    
    if (token) {
      subscriber = await db('newsletter_subscribers')
        .where({ subscription_token: token })
        .first();
    } else if (email) {
      subscriber = await db('newsletter_subscribers')
        .where({ email: email.toLowerCase() })
        .first();
    }
    
    if (!subscriber) {
      return res.status(404).json({ message: 'Subscription not found' });
    }
    
    await db('newsletter_subscribers')
      .where({ id: subscriber.id })
      .update({
        status: 'UNSUBSCRIBED',
        unsubscribed_at: db.fn.now()
      });
    
    res.json({ message: 'Successfully unsubscribed from newsletter' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

// Admin: Get all subscribers
exports.listSubscribers = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '20', 10);
    const status = req.query.status || 'ACTIVE';
    const search = req.query.search || '';
    
    let query = db('newsletter_subscribers')
      .select('*')
      .orderBy('subscribed_at', 'desc');
    
    if (status && status !== 'ALL') {
      query = query.where({ status });
    }
    
    if (search) {
      query = query.where(function() {
        this.whereILike('email', `%${search}%`)
          .orWhereILike('name', `%${search}%`);
      });
    }
    
    const [{ count }] = await query.clone().count({ count: '*' });
    const total = Number(count) || 0;
    
    const subscribers = await query
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    res.json({
      subscribers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('List subscribers error:', error);
    res.status(500).json({ message: 'Failed to fetch subscribers' });
  }
};

// Admin: Get subscriber stats
exports.getStats = async (req, res) => {
  try {
    const [activeCount] = await db('newsletter_subscribers').where({ status: 'ACTIVE' }).count({ count: '*' });
    const [unsubscribedCount] = await db('newsletter_subscribers').where({ status: 'UNSUBSCRIBED' }).count({ count: '*' });
    const [bouncedCount] = await db('newsletter_subscribers').where({ status: 'BOUNCED' }).count({ count: '*' });
    const [totalCampaigns] = await db('newsletter_campaigns').count({ count: '*' });
    const [sentCampaigns] = await db('newsletter_campaigns').where({ status: 'SENT' }).count({ count: '*' });
    
    res.json({
      activeSubscribers: Number(activeCount.count) || 0,
      unsubscribed: Number(unsubscribedCount.count) || 0,
      bounced: Number(bouncedCount.count) || 0,
      totalCampaigns: Number(totalCampaigns.count) || 0,
      sentCampaigns: Number(sentCampaigns.count) || 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// Admin: Create campaign
exports.createCampaign = async (req, res) => {
  const { subject, content, plain_text, scheduled_at } = req.body;
  
  if (!subject || !content) {
    return res.status(400).json({ message: 'Subject and content are required' });
  }
  
  try {
    const [id] = await db('newsletter_campaigns').insert({
      subject,
      content,
      plain_text: plain_text || content.replace(/<[^>]*>/g, ''),
      status: scheduled_at ? 'SCHEDULED' : 'DRAFT',
      admin_id: req.user.sub,
      scheduled_at: scheduled_at || null
    });
    
    const campaign = await db('newsletter_campaigns').where({ id }).first();
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ message: 'Failed to create campaign' });
  }
};

// Admin: List campaigns
exports.listCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.pageSize || '20', 10);
    
    const [{ count }] = await db('newsletter_campaigns').count({ count: '*' });
    const total = Number(count) || 0;
    
    const campaigns = await db('newsletter_campaigns')
      .select('newsletter_campaigns.*', 'users.name as admin_name')
      .leftJoin('users', 'newsletter_campaigns.admin_id', 'users.id')
      .orderBy('newsletter_campaigns.created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    
    res.json({
      campaigns,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    console.error('List campaigns error:', error);
    res.status(500).json({ message: 'Failed to fetch campaigns' });
  }
};

// Admin: Send campaign
exports.sendCampaign = async (req, res) => {
  const { id } = req.params;
  
  try {
    const campaign = await db('newsletter_campaigns').where({ id }).first();
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    if (campaign.status === 'SENT') {
      return res.status(400).json({ message: 'Campaign already sent' });
    }
    
    // Get active subscribers
    const subscribers = await db('newsletter_subscribers')
      .where({ status: 'ACTIVE' })
      .select('id', 'email', 'name', 'subscription_token');
    
    if (subscribers.length === 0) {
      return res.status(400).json({ message: 'No active subscribers' });
    }
    
    // Update campaign status
    await db('newsletter_campaigns')
      .where({ id })
      .update({
        status: 'SENDING',
        total_recipients: subscribers.length,
        sent_at: db.fn.now()
      });
    
    // Send emails asynchronously
    let sentCount = 0;
    let failedCount = 0;
    
    for (const subscriber of subscribers) {
      try {
        const unsubscribeLink = `${process.env.APP_URL}/unsubscribe?token=${subscriber.subscription_token}`;
        const emailContent = campaign.content.replace(/\{unsubscribe_link\}/g, unsubscribeLink);
        
        await sendMail({
          to: subscriber.email,
          subject: campaign.subject,
          html: emailContent + `<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;"><p style="color: #666; font-size: 12px;"><a href="${unsubscribeLink}">Unsubscribe</a></p>`
        });
        
        sentCount++;
        
        // Log success
        await db('newsletter_logs').insert({
          campaign_id: id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          status: 'SENT',
          sent_at: db.fn.now()
        });
      } catch (error) {
        failedCount++;
        console.error(`Failed to send to ${subscriber.email}:`, error);
        
        // Log failure
        await db('newsletter_logs').insert({
          campaign_id: id,
          subscriber_id: subscriber.id,
          email: subscriber.email,
          status: 'FAILED',
          error_message: error.message,
          sent_at: db.fn.now()
        });
      }
    }
    
    // Update final status
    await db('newsletter_campaigns')
      .where({ id })
      .update({
        status: 'SENT',
        sent_count: sentCount,
        failed_count: failedCount
      });
    
    res.json({
      message: 'Campaign sent successfully',
      sent: sentCount,
      failed: failedCount,
      total: subscribers.length
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    
    // Mark campaign as failed
    await db('newsletter_campaigns')
      .where({ id })
      .update({ status: 'FAILED' });
    
    res.status(500).json({ message: 'Failed to send campaign' });
  }
};

// Admin: Delete campaign
exports.deleteCampaign = async (req, res) => {
  const { id } = req.params;
  
  try {
    await db('newsletter_campaigns').where({ id }).delete();
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({ message: 'Failed to delete campaign' });
  }
};

// Admin: Delete subscriber
exports.deleteSubscriber = async (req, res) => {
  const { id } = req.params;
  
  try {
    await db('newsletter_subscribers').where({ id }).delete();
    res.json({ message: 'Subscriber deleted successfully' });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({ message: 'Failed to delete subscriber' });
  }
};

module.exports = exports;
