/**
 * Paystack Service
 * Handles all Paystack payment gateway operations
 */

const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/db');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY;
const PAYSTACK_BASE_URL = 'https://api.paystack.co';

class PaystackService {
  
  /**
   * Initialize a payment transaction
   */
  static async initializePayment({ email, amount, currency = 'NGN', metadata = {}, callback_url = null }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        {
          email,
          amount: Math.round(amount * 100), // Convert to kobo
          currency,
          metadata,
          callback_url: callback_url || `${process.env.APP_URL}/payment/callback`,
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          authorization_url: response.data.data.authorization_url,
          access_code: response.data.data.access_code,
          reference: response.data.data.reference
        };
      }

      throw new Error(response.data.message || 'Payment initialization failed');
    } catch (error) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initialize payment');
    }
  }

  /**
   * Verify a payment transaction
   */
  static async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
          }
        }
      );

      if (response.data.status && response.data.data.status === 'success') {
        return {
          success: true,
          data: {
            reference: response.data.data.reference,
            amount: response.data.data.amount / 100, // Convert from kobo
            currency: response.data.data.currency,
            status: response.data.data.status,
            paid_at: response.data.data.paid_at,
            channel: response.data.data.channel,
            authorization: response.data.data.authorization,
            customer: response.data.data.customer,
            metadata: response.data.data.metadata
          }
        };
      }

      return {
        success: false,
        message: response.data.message || 'Payment verification failed'
      };
    } catch (error) {
      console.error('Paystack verification error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to verify payment');
    }
  }

  /**
   * Charge a saved authorization
   */
  static async chargeAuthorization({ authorization_code, email, amount, currency = 'NGN', metadata = {} }) {
    try {
      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/charge_authorization`,
        {
          authorization_code,
          email,
          amount: Math.round(amount * 100),
          currency,
          metadata
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          reference: response.data.data.reference,
          status: response.data.data.status
        };
      }

      throw new Error(response.data.message || 'Charge failed');
    } catch (error) {
      console.error('Paystack charge error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to charge card');
    }
  }

  /**
   * Process a refund
   */
  static async processRefund(transactionReference, amount = null, currency = 'NGN') {
    try {
      const payload = { transaction: transactionReference, currency };
      if (amount) {
        payload.amount = Math.round(amount * 100); // Partial refund
      }

      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/refund`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          data: response.data.data
        };
      }

      throw new Error(response.data.message || 'Refund failed');
    } catch (error) {
      console.error('Paystack refund error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to process refund');
    }
  }

  /**
   * List payment transactions
   */
  static async listTransactions({ page = 1, perPage = 50, from = null, to = null, status = null }) {
    try {
      const params = { page, perPage };
      if (from) params.from = from;
      if (to) params.to = to;
      if (status) params.status = status;

      const response = await axios.get(`${PAYSTACK_BASE_URL}/transaction`, {
        params,
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      });

      if (response.data.status) {
        return {
          success: true,
          data: response.data.data,
          meta: response.data.meta
        };
      }

      throw new Error(response.data.message || 'Failed to list transactions');
    } catch (error) {
      console.error('Paystack list error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to list transactions');
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return hash === signature;
  }

  /**
   * Get Paystack public key
   */
  static getPublicKey() {
    return PAYSTACK_PUBLIC_KEY;
  }

  /**
   * Validate card number (client-side helper)
   */
  static validateCardNumber(cardNumber) {
    // Luhn algorithm
    const digits = cardNumber.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * Get card type from number
   */
  static getCardType(cardNumber) {
    const patterns = {
      visa: /^4/,
      mastercard: /^5[1-5]/,
      amex: /^3[47]/,
      discover: /^6(?:011|5)/,
      verve: /^(506[01]|507[89]|6500)/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(cardNumber)) {
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount, currency = 'NGN') {
    const formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    });
    
    return formatter.format(amount);
  }
}

module.exports = PaystackService;
