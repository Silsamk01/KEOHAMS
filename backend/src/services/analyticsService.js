const db = require('../config/db');

class AnalyticsService {
  /**
   * Track analytics event
   */
  static async trackEvent(eventType, eventData = {}, req = null) {
    const eventRecord = {
      event_type: eventType,
      event_name: eventData.eventName || null,
      event_data: JSON.stringify(eventData),
      page_url: eventData.pageUrl || null,
      referrer: eventData.referrer || null,
      user_id: eventData.userId || null,
      session_id: eventData.sessionId || null
    };

    if (req) {
      eventRecord.user_agent = req.headers['user-agent'];
      eventRecord.ip_address = req.ip || req.connection.remoteAddress;
    }

    await db('analytics_events').insert(eventRecord);
  }

  /**
   * Track conversion funnel step
   */
  static async trackFunnelStep(step, data, trx = null) {
    const dbConn = trx || db;

    await dbConn('conversion_funnel').insert({
      session_id: data.sessionId,
      user_id: data.userId || null,
      step,
      product_id: data.productId || null,
      cart_id: data.cartId || null,
      order_id: data.orderId || null,
      cart_value: data.cartValue || null
    });
  }

  /**
   * Get revenue report
   */
  static async getRevenueReport(startDate, endDate, groupBy = 'day') {
    let query = db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .whereIn('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']);

    if (groupBy === 'day') {
      query = query
        .select(db.raw('DATE(created_at) as date'))
        .sum('total_amount as revenue')
        .count('* as order_count')
        .avg('total_amount as avg_order_value')
        .groupByRaw('DATE(created_at)')
        .orderBy('date', 'asc');
    } else if (groupBy === 'month') {
      query = query
        .select(db.raw('DATE_FORMAT(created_at, "%Y-%m") as month'))
        .sum('total_amount as revenue')
        .count('* as order_count')
        .avg('total_amount as avg_order_value')
        .groupByRaw('DATE_FORMAT(created_at, "%Y-%m")')
        .orderBy('month', 'asc');
    }

    return await query;
  }

  /**
   * Get top selling products
   */
  static async getTopProducts(startDate, endDate, limit = 10) {
    const topProducts = await db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .join('products', 'order_items.product_id', 'products.id')
      .whereBetween('orders.created_at', [startDate, endDate])
      .whereIn('orders.status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .select(
        'products.id',
        'products.title',
        db.raw('SUM(order_items.quantity) as total_units_sold'),
        db.raw('SUM(order_items.quantity * order_items.price) as total_revenue'),
        db.raw('COUNT(DISTINCT orders.id) as order_count')
      )
      .groupBy('products.id', 'products.title')
      .orderBy('total_revenue', 'desc')
      .limit(limit);

    return topProducts;
  }

  /**
   * Get conversion funnel metrics
   */
  static async getConversionFunnel(startDate, endDate) {
    const steps = [
      'PRODUCT_VIEW',
      'ADD_TO_CART',
      'CART_VIEW',
      'CHECKOUT_START',
      'SHIPPING_INFO',
      'PAYMENT_INFO',
      'ORDER_COMPLETE'
    ];

    const funnelData = [];

    for (const step of steps) {
      const count = await db('conversion_funnel')
        .whereBetween('created_at', [startDate, endDate])
        .where('step', step)
        .countDistinct('session_id as count')
        .first();

      funnelData.push({
        step,
        count: count.count,
        drop_off: null,
        conversion_rate: null
      });
    }

    // Calculate drop-off and conversion rates
    for (let i = 0; i < funnelData.length; i++) {
      if (i > 0) {
        const previous = funnelData[i - 1].count;
        const current = funnelData[i].count;
        funnelData[i].drop_off = previous - current;
        funnelData[i].conversion_rate = previous > 0 ? ((current / previous) * 100).toFixed(2) : 0;
      } else {
        funnelData[i].conversion_rate = 100;
      }
    }

    return funnelData;
  }

  /**
   * Get customer analytics
   */
  static async getCustomerAnalytics(startDate, endDate) {
    const totalCustomers = await db('users')
      .where('role', 'customer')
      .count('* as count')
      .first();

    const newCustomers = await db('users')
      .where('role', 'customer')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const activeCustomers = await db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .countDistinct('user_id as count')
      .first();

    const repeatCustomers = await db('orders')
      .select('user_id')
      .whereBetween('created_at', [startDate, endDate])
      .groupBy('user_id')
      .havingRaw('COUNT(*) > 1')
      .then(results => results.length);

    const avgOrdersPerCustomer = await db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as order_count')
      .countDistinct('user_id as customer_count')
      .first();

    return {
      total_customers: totalCustomers.count,
      new_customers: newCustomers.count,
      active_customers: activeCustomers.count,
      repeat_customers: repeatCustomers,
      avg_orders_per_customer: avgOrdersPerCustomer.customer_count > 0 
        ? (avgOrdersPerCustomer.order_count / avgOrdersPerCustomer.customer_count).toFixed(2)
        : 0
    };
  }

  /**
   * Get affiliate performance metrics
   */
  static async getAffiliateMetrics(startDate, endDate, affiliateId = null) {
    let query = db('commission_records')
      .leftJoin('affiliates', 'commission_records.affiliate_id', 'affiliates.id')
      .leftJoin('users', 'affiliates.user_id', 'users.id')
      .whereBetween('commission_records.created_at', [startDate, endDate]);

    if (affiliateId) {
      query = query.where('commission_records.affiliate_id', affiliateId);
    }

    const metrics = await query
      .select(
        'commission_records.affiliate_id',
        'users.name as affiliate_name',
        db.raw('COUNT(*) as total_commissions'),
        db.raw('SUM(commission_records.amount) as total_earned'),
        db.raw('SUM(commission_records.sale_amount) as total_sales_generated')
      )
      .groupBy('commission_records.affiliate_id', 'users.name')
      .orderBy('total_earned', 'desc');

    return metrics;
  }

  /**
   * Get product performance metrics
   */
  static async getProductPerformance(productId, startDate, endDate) {
    const views = await db('analytics_events')
      .where('event_type', 'PRODUCT_VIEW')
      .whereRaw('JSON_EXTRACT(event_data, "$.productId") = ?', [productId])
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const addToCarts = await db('analytics_events')
      .where('event_type', 'ADD_TO_CART')
      .whereRaw('JSON_EXTRACT(event_data, "$.productId") = ?', [productId])
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const sales = await db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .where('order_items.product_id', productId)
      .whereBetween('orders.created_at', [startDate, endDate])
      .whereIn('orders.status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .select(
        db.raw('COUNT(*) as purchase_count'),
        db.raw('SUM(order_items.quantity) as units_sold'),
        db.raw('SUM(order_items.quantity * order_items.price) as revenue')
      )
      .first();

    const conversionRate = views.count > 0 
      ? ((sales.purchase_count / views.count) * 100).toFixed(2)
      : 0;

    return {
      product_id: productId,
      views: views.count,
      add_to_cart: addToCarts.count,
      purchases: sales.purchase_count || 0,
      units_sold: sales.units_sold || 0,
      revenue: sales.revenue || 0,
      conversion_rate: conversionRate
    };
  }

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(startDate, endDate) {
    const revenue = await db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .whereIn('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .sum('total_amount as total')
      .count('* as order_count')
      .avg('total_amount as avg_order_value')
      .first();

    const customers = await this.getCustomerAnalytics(startDate, endDate);

    const products = await db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .whereBetween('orders.created_at', [startDate, endDate])
      .whereIn('orders.status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .sum('order_items.quantity as total_units')
      .first();

    const tickets = await db('support_tickets')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as total')
      .first();

    const affiliates = await db('commission_records')
      .whereBetween('created_at', [startDate, endDate])
      .sum('amount as total_commission')
      .first();

    return {
      revenue: {
        total: revenue.total || 0,
        order_count: revenue.order_count || 0,
        avg_order_value: revenue.avg_order_value || 0
      },
      customers,
      products_sold: products.total_units || 0,
      support_tickets: tickets.total || 0,
      affiliate_commission: affiliates.total_commission || 0
    };
  }

  /**
   * Update daily metrics (cron job)
   */
  static async updateDailyMetrics(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const startDate = `${targetDate} 00:00:00`;
    const endDate = `${targetDate} 23:59:59`;

    const revenue = await db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .whereIn('status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .sum('total_amount as total')
      .count('* as count')
      .avg('total_amount as avg')
      .first();

    const customers = await db('orders')
      .whereBetween('created_at', [startDate, endDate])
      .countDistinct('user_id as active')
      .first();

    const newCustomers = await db('users')
      .where('role', 'customer')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const productsSold = await db('order_items')
      .join('orders', 'order_items.order_id', 'orders.id')
      .whereBetween('orders.created_at', [startDate, endDate])
      .whereIn('orders.status', ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'])
      .sum('order_items.quantity as total')
      .first();

    const visitors = await db('analytics_events')
      .whereBetween('created_at', [startDate, endDate])
      .countDistinct('session_id as count')
      .first();

    const pageViews = await db('analytics_events')
      .where('event_type', 'PAGE_VIEW')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const conversionRate = visitors.count > 0
      ? ((revenue.count / visitors.count) * 100).toFixed(2)
      : 0;

    const tickets = await db('support_tickets')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const affiliateSignups = await db('affiliates')
      .whereBetween('created_at', [startDate, endDate])
      .count('* as count')
      .first();

    const commission = await db('commission_records')
      .whereBetween('created_at', [startDate, endDate])
      .sum('amount as total')
      .first();

    const metrics = {
      metric_date: targetDate,
      total_revenue: revenue.total || 0,
      total_orders: revenue.count || 0,
      total_customers: customers.active || 0,
      new_customers: newCustomers.count || 0,
      total_products_sold: productsSold.total || 0,
      average_order_value: revenue.avg || 0,
      total_visitors: visitors.count || 0,
      total_page_views: pageViews.count || 0,
      conversion_rate: conversionRate,
      support_tickets_created: tickets.count || 0,
      affiliate_signups: affiliateSignups.count || 0,
      total_commission_paid: commission.total || 0,
      updated_at: db.fn.now()
    };

    // Upsert (insert or update)
    const existing = await db('daily_metrics')
      .where('metric_date', targetDate)
      .first();

    if (existing) {
      await db('daily_metrics')
        .where('metric_date', targetDate)
        .update(metrics);
    } else {
      await db('daily_metrics').insert(metrics);
    }

    return metrics;
  }
}

module.exports = AnalyticsService;
