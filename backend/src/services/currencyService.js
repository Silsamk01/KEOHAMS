const db = require('../config/db');
const axios = require('axios');

class CurrencyService {
  /**
   * Get all active currencies
   */
  static async getActiveCurrencies() {
    return await db('currencies')
      .where('is_active', true)
      .orderBy('code', 'asc');
  }

  /**
   * Get default currency
   */
  static async getDefaultCurrency() {
    return await db('currencies')
      .where('is_default', true)
      .first();
  }

  /**
   * Convert amount between currencies
   */
  static async convertAmount(amount, fromCurrencyCode, toCurrencyCode) {
    const fromCurrency = await db('currencies')
      .where('code', fromCurrencyCode)
      .first();

    const toCurrency = await db('currencies')
      .where('code', toCurrencyCode)
      .first();

    if (!fromCurrency || !toCurrency) {
      throw new Error('Invalid currency code');
    }

    // Convert to base currency (USD) then to target currency
    const amountInBase = amount / fromCurrency.exchange_rate;
    const convertedAmount = amountInBase * toCurrency.exchange_rate;

    return {
      original_amount: parseFloat(amount),
      original_currency: fromCurrencyCode,
      converted_amount: parseFloat(convertedAmount.toFixed(2)),
      converted_currency: toCurrencyCode,
      exchange_rate: parseFloat((toCurrency.exchange_rate / fromCurrency.exchange_rate).toFixed(6))
    };
  }

  /**
   * Update exchange rates from external API
   */
  static async updateExchangeRates() {
    try {
      const apiUrl = process.env.EXCHANGE_API_URL || 'https://api.exchangerate.host/latest';
      const baseCode = process.env.EXCHANGE_BASE || 'USD';

      const response = await axios.get(apiUrl, {
        params: { base: baseCode }
      });

      if (!response.data || !response.data.rates) {
        throw new Error('Invalid API response');
      }

      const rates = response.data.rates;
      const updatePromises = [];

      for (const [code, rate] of Object.entries(rates)) {
        updatePromises.push(
          db('currencies')
            .where('code', code)
            .update({
              exchange_rate: rate,
              rate_updated_at: db.fn.now(),
              updated_at: db.fn.now()
            })
        );
      }

      await Promise.all(updatePromises);

      return {
        success: true,
        updated_count: updatePromises.length,
        base_currency: baseCode
      };
    } catch (error) {
      console.error('Update exchange rates error:', error);
      throw new Error('Failed to update exchange rates: ' + error.message);
    }
  }

  /**
   * Set user currency preference
   */
  static async setUserCurrencyPreference(userId, currencyCode, trx = null) {
    const dbConn = trx || db;

    const currency = await dbConn('currencies')
      .where('code', currencyCode)
      .where('is_active', true)
      .first();

    if (!currency) {
      throw new Error('Invalid or inactive currency');
    }

    const existing = await dbConn('user_currency_preferences')
      .where('user_id', userId)
      .first();

    if (existing) {
      await dbConn('user_currency_preferences')
        .where('user_id', userId)
        .update({
          currency_id: currency.id,
          updated_at: dbConn.fn.now()
        });
    } else {
      await dbConn('user_currency_preferences').insert({
        user_id: userId,
        currency_id: currency.id
      });
    }

    return { user_id: userId, currency_code: currencyCode };
  }

  /**
   * Get user currency preference
   */
  static async getUserCurrencyPreference(userId) {
    const preference = await db('user_currency_preferences')
      .join('currencies', 'user_currency_preferences.currency_id', 'currencies.id')
      .where('user_currency_preferences.user_id', userId)
      .select('currencies.*')
      .first();

    if (preference) {
      return preference;
    }

    // Return default currency if no preference set
    return await this.getDefaultCurrency();
  }

  /**
   * Get product price in specific currency
   */
  static async getProductPriceInCurrency(productId, currencyCode) {
    const product = await db('products')
      .where('id', productId)
      .first('price_per_unit');

    if (!product) {
      throw new Error('Product not found');
    }

    const defaultCurrency = await this.getDefaultCurrency();
    
    if (currencyCode === defaultCurrency.code) {
      return {
        product_id: productId,
        price: product.price_per_unit,
        currency: defaultCurrency
      };
    }

    const converted = await this.convertAmount(
      product.price_per_unit,
      defaultCurrency.code,
      currencyCode
    );

    const targetCurrency = await db('currencies')
      .where('code', currencyCode)
      .first();

    return {
      product_id: productId,
      price: converted.converted_amount,
      currency: targetCurrency,
      original_price: product.price_per_unit,
      original_currency: defaultCurrency
    };
  }
}

module.exports = CurrencyService;
