const db = require('../config/db');
const Quotation = require('../models/quotation');
const Products = require('../models/product'); // assuming product model exists
const { sendMail } = require('../utils/email');
const axios = require('axios');
const crypto = require('crypto');

// Helper to load product pricing snapshot
async function mapItems(rawItems){
  const productIds = [...new Set(rawItems.map(i=> i.product_id))];
  const rows = await db('products').whereIn('id', productIds);
  const map = new Map(rows.map(r=> [r.id, r]));
  return rawItems.map(i=>{
    const p = map.get(i.product_id);
    if(!p) throw new Error('Product not found: '+ i.product_id);
    const qty = Number(i.quantity)||1;
    // Attempt multiple potential price field names to ensure snapshot
    const priceCandidate = [p.price, p.unit_price, p.price_per_unit, p.base_price, p.amount]
      .map(v=> Number(v))
      .find(v=> !isNaN(v) && v>=0);
    const unit = priceCandidate!=null ? priceCandidate : 0;
    return {
      product_id: p.id,
      product_name: p.title || p.name || 'Product',
      quantity: qty,
      unit_price: unit,
      line_total: unit * qty
    };
  });
}

// USER: request quotation
exports.requestQuotation = async (req, res) => {
  const { items, notes } = req.body;
  if(!Array.isArray(items) || !items.length) return res.status(400).json({ message:'Items required' });
  try {
    const mapped = await mapItems(items);
    const q = await Quotation.createRequest(req.user.sub, mapped, { notes_user: notes });
    // Email user (best-effort)
    try { await maybeEmail(req.user.sub, 'Quotation Request Received', `<p>Your quotation <strong>${q.reference}</strong> has been received. We'll reply soon.</p>`); } catch(_){ }
    res.status(201).json(q);
  } catch(e){
    // Friendlier error if migrations not applied yet
    if (e && /ER_NO_SUCH_TABLE|doesn't exist/i.test(e.message)) {
      return res.status(500).json({ message: 'Quotation system not initialized. Run migrations.' });
    }
    res.status(400).json({ message: e.message || 'Failed' });
  }
};

// USER: list mine
exports.listMine = async (req,res)=>{
  const page = parseInt(req.query.page||'1',10)||1;
  const pageSize = Math.min(parseInt(req.query.pageSize||'10',10)||10,50);
  const data = await Quotation.listForUser(req.user.sub, { page, pageSize });
  res.json(data);
};

// USER: get single
exports.getMine = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  const q = await Quotation.getDetailed(id);
  if(!q || q.user_id !== req.user.sub) return res.status(404).json({ message:'Not found' });
  res.json(q);
};

// USER: initiate payment (mock)
exports.initiatePayment = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  const { method } = req.body;
  const q = await Quotation.getDetailed(id);
  if(!q || q.user_id !== req.user.sub) return res.status(404).json({ message:'Not found' });
  if(q.status !== 'REPLIED') return res.status(400).json({ message:'Not payable' });
  const allowed = (q.allowed_payment_methods||'').split(',').filter(Boolean);
  if(!allowed.includes(method)) return res.status(400).json({ message:'Method not allowed' });
  // Simulate provider init using env keys presence
  let payload = {};
  if(method==='stripe'){
    payload = { provider:'stripe', publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_dummy', clientSecret: 'cs_test_dummy', amount: q.total_amount };
  } else if(method==='paystack') {
    // Initialize real Paystack transaction
    try {
      const response = await axios.post('https://api.paystack.co/transaction/initialize', {
        email: q.user_email,
        amount: Math.round(q.total_amount * 100), // Paystack expects kobo (for NGN, but assume USD cents equivalent)
        reference: `QUO-${q.id}-${Date.now()}`,
        callback_url: `${req.protocol}://${req.get('host')}/dashboard/quotations`,
        metadata: { quotation_id: q.id, user_id: q.user_id }
      }, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.data.status) {
        payload = { provider:'paystack', publicKey: process.env.PAYSTACK_PUBLIC_KEY, authorization_url: response.data.data.authorization_url, reference: response.data.data.reference };
      } else {
        return res.status(500).json({ message: 'Paystack init failed' });
      }
    } catch (e) {
      console.error('Paystack init error:', e.response?.data || e.message);
      return res.status(500).json({ message: 'Payment init failed' });
    }
  } else if(method==='crypto') {
    payload = { provider:'crypto', address: process.env.CRYPTO_PAYMENT_ADDRESS || '0xDUMMY', amount: q.total_amount };
  } else {
    return res.status(400).json({ message:'Unsupported method' });
  }
  res.json({ quotation_id: q.id, method, payload });
};

// ADMIN: list
exports.adminList = async (req,res)=>{
  const page = parseInt(req.query.page||'1',10)||1;
  const pageSize = Math.min(parseInt(req.query.pageSize||'20',10)||20,100);
  const status = (req.query.status||'').trim()||undefined;
  const user_id = req.query.user_id ? parseInt(req.query.user_id,10): undefined;
  const data = await Quotation.listAll({ page, pageSize, status, user_id });
  res.json(data);
};

// ADMIN: get
exports.adminGet = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  const q = await Quotation.getDetailed(id);
  if(!q) return res.status(404).json({ message:'Not found' });
  res.json(q);
};

// ADMIN: reply
exports.adminReply = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  const { logistics_amount, discount_amount, allowed_payment_methods, notes_admin } = req.body;
  try {
    const q = await Quotation.reply(id, { logistics_amount, discount_amount, allowed_payment_methods, notes_admin });
    // Send notification to user
    try {
      const Notifications = require('../models/notification');
      await Notifications.create({
        user_id: q.user_id,
        title: 'Quotation Updated',
        body: `Your quotation ${q.reference} has been updated. Total: $${q.total_amount.toFixed(2)}`,
        audience: 'USER',
        url: `/dashboard?pane=quotations`
      });
    } catch(notifErr){ console.warn('Failed to create notification:', notifErr); }
    // Email user quoting final total
    try { await maybeEmail(q.user_id, 'Quotation Updated', `<p>Your quotation <strong>${q.reference}</strong> has been updated. Total: ${q.total_amount}</p>`); } catch(_){ }
    res.json(q);
  } catch(e){ res.status(400).json({ message: e.message || 'Failed' }); }
};

// ADMIN: mark paid
exports.adminMarkPaid = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try {
    const q = await Quotation.markPaid(id);
    res.json(q);
  } catch(e){ res.status(400).json({ message: e.message || 'Failed' }); }
};

// ADMIN: cancel
exports.adminCancel = async (req,res)=>{
  const id = parseInt(req.params.id,10);
  try {
    const q = await Quotation.cancel(id);
    res.json(q);
  } catch(e){ res.status(400).json({ message: e.message || 'Failed' }); }
};

async function maybeEmail(userId, subject, html){
  try {
    const user = await db('users').where({ id: userId }).first();
    if(user?.email){
      await sendMail({ to: user.email, subject, html });
    }
  } catch(e){ /* log quietly */ }
}

// Paystack webhook
exports.paystackWebhook = async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = req.headers['x-paystack-signature'];
  const body = JSON.stringify(req.body);
  const expectedHash = require('crypto').createHmac('sha512', secret).update(body).digest('hex');
  if (hash !== expectedHash) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  if (event.event === 'charge.success') {
    const { reference, metadata } = event.data;
    const quotationId = metadata?.quotation_id;
    if (quotationId) {
      try {
        // Update quotation to FULFILLMENT_PENDING
        const q = await Quotation.markPaid(quotationId);

        // Send notification to admins
        const Notifications = require('../models/notification');
        await Notifications.create({
          title: 'Quotation Paid',
          body: `Quotation ${q.reference} has been paid. Ready for fulfillment.`,
          audience: 'ADMIN',
          url: `/admin/quotations/${quotationId}`
        });

        // Email user
        await maybeEmail(q.user_id, 'Payment Confirmed', `<p>Your payment for quotation <strong>${q.reference}</strong> has been confirmed. We will process your order soon.</p>`);
      } catch (e) {
        console.error('Webhook processing error:', e);
        return res.status(500).send('Processing failed');
      }
    }
  }
  res.sendStatus(200);
};
