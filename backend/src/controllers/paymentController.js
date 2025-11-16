/**
 * Payment Controller
 * Handles payment-related operations
 */

const PaystackService = require('../services/paystackService');
const db = require('../config/db');

/**
 * Initialize payment for an order or quotation
 */
exports.initializePayment = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { order_id, quotation_id, amount, currency = 'NGN', save_card = false } = req.body;
    const user_id = req.user.id;

    if (!order_id && !quotation_id) {
      return res.status(400).json({ error: 'Either order_id or quotation_id is required' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Get user details
    const user = await trx('users').where('id', user_id).first();
    if (!user) {
      await trx.rollback();
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify order/quotation exists and belongs to user
    let entity = null;
    let entityType = null;

    if (order_id) {
      entity = await trx('orders').where({ id: order_id, user_id }).first();
      entityType = 'order';
    } else {
      entity = await trx('quotations').where({ id: quotation_id, user_id }).first();
      entityType = 'quotation';
    }

    if (!entity) {
      await trx.rollback();
      return res.status(404).json({ error: `${entityType} not found or does not belong to you` });
    }

    // Check if already paid
    if (entity.payment_status === 'PAID') {
      await trx.rollback();
      return res.status(400).json({ error: `This ${entityType} has already been paid` });
    }

    // Generate unique reference
    const reference = `KEOH-${Date.now()}-${user_id}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

    // Create transaction record
    const [transaction_id] = await trx('payment_transactions').insert({
      user_id,
      order_id: order_id || null,
      quotation_id: quotation_id || null,
      reference,
      amount,
      currency,
      status: 'PENDING',
      customer_email: user.email,
      customer_name: user.name,
      ip_address: req.ip,
      metadata: JSON.stringify({
        entity_type: entityType,
        entity_id: order_id || quotation_id,
        save_card
      })
    });

    // Initialize payment with Paystack
    const paystackResponse = await PaystackService.initializePayment({
      email: user.email,
      amount,
      currency,
      metadata: {
        user_id,
        transaction_id,
        entity_type: entityType,
        entity_id: order_id || quotation_id,
        custom_fields: [
          {
            display_name: 'Customer Name',
            variable_name: 'customer_name',
            value: user.name
          },
          {
            display_name: entityType === 'order' ? 'Order ID' : 'Quotation ID',
            variable_name: 'entity_id',
            value: order_id || quotation_id
          }
        ]
      }
    });

    // Update transaction with Paystack reference
    await trx('payment_transactions')
      .where('id', transaction_id)
      .update({
        paystack_reference: paystackResponse.reference
      });

    // Update entity status to pending payment
    const updateData = { payment_status: 'PENDING', payment_transaction_id: transaction_id };
    if (entityType === 'order') {
      await trx('orders').where('id', order_id).update(updateData);
    } else {
      await trx('quotations').where('id', quotation_id).update(updateData);
    }

    await trx.commit();

    res.json({
      success: true,
      message: 'Payment initialized successfully',
      data: {
        transaction_id,
        reference,
        authorization_url: paystackResponse.authorization_url,
        access_code: paystackResponse.access_code
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Payment initialization error:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize payment' });
  }
};

/**
 * Verify payment callback
 */
exports.verifyPayment = async (req, res) => {
  const trx = await db.transaction();
  
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    // Get transaction from database
    const transaction = await trx('payment_transactions')
      .where('reference', reference)
      .orWhere('paystack_reference', reference)
      .first();

    if (!transaction) {
      await trx.rollback();
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // If already verified, return success
    if (transaction.status === 'SUCCESS') {
      await trx.commit();
      return res.json({
        success: true,
        message: 'Payment already verified',
        data: { transaction }
      });
    }

    // Verify with Paystack
    const verificationResult = await PaystackService.verifyPayment(reference);

    if (!verificationResult.success) {
      await trx('payment_transactions')
        .where('id', transaction.id)
        .update({
          status: 'FAILED',
          error_message: verificationResult.message
        });
      
      await trx.commit();
      return res.status(400).json({ error: verificationResult.message });
    }

    const paymentData = verificationResult.data;

    // Update transaction
    await trx('payment_transactions')
      .where('id', transaction.id)
      .update({
        status: 'SUCCESS',
        payment_method: paymentData.channel?.toUpperCase(),
        paystack_reference: paymentData.reference,
        authorization_code: paymentData.authorization?.authorization_code,
        card_type: paymentData.authorization?.card_type,
        card_last4: paymentData.authorization?.last4,
        bank: paymentData.authorization?.bank,
        channel: paymentData.channel,
        paid_at: new Date(paymentData.paid_at),
        verified_at: new Date(),
        metadata: JSON.stringify({
          ...JSON.parse(transaction.metadata || '{}'),
          paystack_response: paymentData
        })
      });

    // Update order/quotation status
    const entityType = transaction.order_id ? 'order' : 'quotation';
    const entityId = transaction.order_id || transaction.quotation_id;
    
    const updateData = {
      payment_status: 'PAID',
      paid_at: new Date(paymentData.paid_at)
    };

    if (entityType === 'order') {
      await trx('orders').where('id', entityId).update({
        ...updateData,
        status: 'PROCESSING' // Move from pending to processing
      });
    } else {
      await trx('quotations').where('id', entityId).update({
        ...updateData,
        status: 'ACCEPTED' // Mark quotation as accepted
      });
    }

    // Save payment method if requested
    const metadata = JSON.parse(transaction.metadata || '{}');
    if (metadata.save_card && paymentData.authorization?.authorization_code) {
      await trx('saved_payment_methods')
        .insert({
          user_id: transaction.user_id,
          authorization_code: paymentData.authorization.authorization_code,
          card_type: paymentData.authorization.card_type,
          card_last4: paymentData.authorization.last4,
          exp_month: paymentData.authorization.exp_month,
          exp_year: paymentData.authorization.exp_year,
          bank: paymentData.authorization.bank,
          card_bin: paymentData.authorization.bin,
          is_default: false
        })
        .onConflict('authorization_code')
        .ignore();
    }

    await trx.commit();

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transaction_id: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        status: 'SUCCESS',
        paid_at: paymentData.paid_at
      }
    });

  } catch (error) {
    await trx.rollback();
    console.error('Payment verification error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify payment' });
  }
};

/**
 * Handle Paystack webhook
 */
exports.handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const payload = req.body;

    // Verify webhook signature
    if (!PaystackService.verifyWebhookSignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Log webhook
    const [webhook_id] = await db('payment_webhooks').insert({
      event_type: payload.event,
      reference: payload.data?.reference,
      payload: JSON.stringify(payload),
      status: 'PENDING',
      ip_address: req.ip
    });

    // Process webhook event
    try {
      switch (payload.event) {
        case 'charge.success':
          await processChargeSuccess(payload.data);
          break;
        
        case 'charge.failed':
          await processChargeFailed(payload.data);
          break;
        
        case 'refund.pending':
        case 'refund.processed':
        case 'refund.failed':
          await processRefundEvent(payload.event, payload.data);
          break;
        
        default:
          console.log(`Unhandled webhook event: ${payload.event}`);
      }

      // Mark webhook as processed
      await db('payment_webhooks')
        .where('id', webhook_id)
        .update({
          status: 'PROCESSED',
          processed_at: new Date()
        });

    } catch (error) {
      // Mark webhook as failed
      await db('payment_webhooks')
        .where('id', webhook_id)
        .update({
          status: 'FAILED',
          error_message: error.message,
          processed_at: new Date()
        });
      
      throw error;
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

/**
 * Process charge success webhook
 */
async function processChargeSuccess(data) {
  const trx = await db.transaction();
  
  try {
    const transaction = await trx('payment_transactions')
      .where('reference', data.reference)
      .orWhere('paystack_reference', data.reference)
      .first();

    if (!transaction) {
      console.error(`Transaction not found for reference: ${data.reference}`);
      await trx.rollback();
      return;
    }

    if (transaction.status === 'SUCCESS') {
      await trx.commit();
      return; // Already processed
    }

    // Update transaction
    await trx('payment_transactions')
      .where('id', transaction.id)
      .update({
        status: 'SUCCESS',
        paid_at: new Date(data.paid_at),
        verified_at: new Date()
      });

    // Update order/quotation
    const entityType = transaction.order_id ? 'order' : 'quotation';
    const entityId = transaction.order_id || transaction.quotation_id;
    
    if (entityType === 'order') {
      await trx('orders').where('id', entityId).update({
        payment_status: 'PAID',
        paid_at: new Date(data.paid_at),
        status: 'PROCESSING'
      });
    } else {
      await trx('quotations').where('id', entityId).update({
        payment_status: 'PAID',
        paid_at: new Date(data.paid_at),
        status: 'ACCEPTED'
      });
    }

    await trx.commit();
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

/**
 * Process charge failed webhook
 */
async function processChargeFailed(data) {
  await db('payment_transactions')
    .where('reference', data.reference)
    .orWhere('paystack_reference', data.reference)
    .update({
      status: 'FAILED',
      error_message: data.gateway_response || 'Payment failed'
    });
}

/**
 * Process refund event webhook
 */
async function processRefundEvent(event, data) {
  const status = event === 'refund.processed' ? 'SUCCESS' : event === 'refund.failed' ? 'FAILED' : 'PROCESSING';
  
  await db('payment_refunds')
    .where('refund_reference', data.transaction_reference)
    .update({
      status,
      paystack_response: JSON.stringify(data),
      processed_at: new Date()
    });
}

/**
 * Get payment history
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20, status = null } = req.query;
    const offset = (page - 1) * limit;

    let query = db('payment_transactions')
      .where('user_id', user_id)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where('status', status);
    }

    const transactions = await query;
    const [{ total }] = await db('payment_transactions')
      .where('user_id', user_id)
      .count('* as total');

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to get payment history' });
  }
};

/**
 * Get saved payment methods
 */
exports.getSavedPaymentMethods = async (req, res) => {
  try {
    const user_id = req.user.id;

    const methods = await db('saved_payment_methods')
      .where({ user_id, is_active: true })
      .orderBy('is_default', 'desc')
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: methods
    });

  } catch (error) {
    console.error('Get saved payment methods error:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
};

/**
 * Delete saved payment method
 */
exports.deleteSavedPaymentMethod = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { id } = req.params;

    const method = await db('saved_payment_methods')
      .where({ id, user_id })
      .first();

    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    await db('saved_payment_methods')
      .where({ id, user_id })
      .update({ is_active: false });

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });

  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
};

/**
 * Get Paystack public key
 */
exports.getPublicKey = (req, res) => {
  res.json({
    success: true,
    public_key: PaystackService.getPublicKey()
  });
};

module.exports = exports;
