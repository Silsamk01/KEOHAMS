const express = require('express');
const router = express.Router();
const CurrencyService = require('../services/currencyService');
const { verifyToken } = require('../middlewares/auth');
const { isAdmin } = require('../middlewares/adminAuth');

// Public routes
router.get('/list', async (req, res) => {
  try {
    const currencies = await CurrencyService.getActiveCurrencies();
    res.json({ success: true, data: currencies });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/convert', async (req, res) => {
  try {
    const { amount, from, to } = req.body;
    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'Amount, from, and to currencies are required' });
    }
    const result = await CurrencyService.convertAmount(parseFloat(amount), from.toUpperCase(), to.toUpperCase());
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/product/:productId/price', async (req, res) => {
  try {
    const { productId } = req.params;
    const { currency = 'USD' } = req.query;
    const result = await CurrencyService.getProductPriceInCurrency(productId, currency.toUpperCase());
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Protected routes
router.use(verifyToken);

router.get('/preference', async (req, res) => {
  try {
    const currency = await CurrencyService.getUserCurrencyPreference(req.user.id);
    res.json({ success: true, data: currency });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/preference', async (req, res) => {
  try {
    const { currencyCode } = req.body;
    if (!currencyCode) {
      return res.status(400).json({ error: 'Currency code is required' });
    }
    const result = await CurrencyService.setUserCurrencyPreference(req.user.id, currencyCode.toUpperCase());
    res.json({ success: true, message: 'Currency preference updated', data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin routes
router.post('/update-rates', isAdmin, async (req, res) => {
  try {
    const result = await CurrencyService.updateExchangeRates();
    res.json({ success: true, message: 'Exchange rates updated', data: result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
