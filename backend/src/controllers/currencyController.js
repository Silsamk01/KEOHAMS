const axios = require('axios');

// Simple in-memory cache { key: { ts: Date, data } }
const CACHE = {};
const TTL_MS = 10 * 60 * 1000; // 10 minutes

// Fallback reference rates relative to USD (approximate) if external API unreachable
const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  NGN: 1550, // update as required
  GHS: 15.5,
  KES: 128,
  ZAR: 18.3,
  JPY: 149,
  CAD: 1.36,
  AUD: 1.52,
};

const SUPPORTED = Object.keys(FALLBACK_RATES);

async function fetchRates(base = 'USD') {
  base = base.toUpperCase();
  if (!SUPPORTED.includes(base)) base = 'USD';
  const cacheKey = `rates:${base}`;
  const now = Date.now();
  const cached = CACHE[cacheKey];
  if (cached && (now - cached.ts) < TTL_MS) return cached.data;

  const url = process.env.EXCHANGE_RATES_BASE_URL || 'https://api.exchangerate.host/latest';
  try {
    const { data } = await axios.get(url, { params: { base } });
    if (data && data.rates) {
      // Filter to supported set for consistency
      const filtered = { base, rates: {} };
      SUPPORTED.forEach(c => { if (data.rates[c]) filtered.rates[c] = data.rates[c]; });
      // Ensure base always 1
      filtered.rates[base] = 1;
      CACHE[cacheKey] = { ts: now, data: filtered };
      return filtered;
    }
    throw new Error('Malformed response');
  } catch (e) {
    // Derive fallback relative to requested base
    const baseUsd = FALLBACK_RATES[base]; // may not exist if base was forced to USD
    const conv = { base, rates: {} };
    SUPPORTED.forEach(c => {
      if (c === base) conv.rates[c] = 1; else {
        // Convert via USD: value_c / value_base
        conv.rates[c] = (FALLBACK_RATES[c] / (FALLBACK_RATES[base] || 1));
      }
    });
    CACHE[cacheKey] = { ts: now, data: conv };
    return conv;
  }
}

async function listSupported(req, res) {
  res.json({ data: SUPPORTED });
}

async function getRates(req, res) {
  const base = (req.query.base || 'USD').toUpperCase();
  const data = await fetchRates(base);
  res.json({ data });
}

async function convert(req, res) {
  let { from = 'USD', to = 'NGN', amount = '1' } = req.query;
  from = String(from).toUpperCase();
  to = String(to).toUpperCase();
  amount = parseFloat(amount);
  if (!amount || amount < 0) return res.status(400).json({ message: 'Invalid amount' });
  if (!SUPPORTED.includes(from) || !SUPPORTED.includes(to)) return res.status(400).json({ message: 'Unsupported currency' });
  const { rates } = await fetchRates(from);
  const rate = rates[to];
  const result = amount * rate;
  res.json({ from, to, amount, rate, result });
}

module.exports = { listSupported, getRates, convert, SUPPORTED };
