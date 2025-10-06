const db = require('../config/db');
const ALLOWED_METHODS = ['stripe','paystack','crypto'];

function genReference(){
  return 'QUO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase();
}

async function createRequest(userId, items, { notes_user, currency='USD' }={}){
  if(!Array.isArray(items) || !items.length) throw new Error('No items');
  // We assume caller already validated product existence & pricing (future: join products)
  const subtotal = items.reduce((a,i)=> a + (Number(i.unit_price)||0)* (Number(i.quantity)||0), 0);
  const reference = genReference();
  const [id] = await db('quotations').insert({
    reference,
    user_id: userId,
    status: 'REQUESTED',
    subtotal_amount: subtotal,
    logistics_amount: 0,
    discount_amount: 0,
    total_amount: subtotal,
    currency,
    allowed_payment_methods: null,
    notes_user: notes_user || null
  });
  for(const it of items){
    const qty = Number(it.quantity)||1;
    const unit = Number(it.unit_price)||0;
    await db('quotation_items').insert({
      quotation_id: id,
      product_id: it.product_id,
      product_name: it.product_name || it.title || 'Item',
      quantity: qty,
      unit_price: unit,
      line_total: qty * unit
    });
  }
  return getDetailed(id);
}

async function getDetailed(id){
  const row = await db('quotations as q')
    .leftJoin('users as u', 'u.id', 'q.user_id')
    .select('q.*', 'u.name as user_name', 'u.email as user_email')
    .where('q.id', id)
    .first();
  if(!row) return null;
  const items = await db('quotation_items').where({ quotation_id: id }).orderBy('id','asc');
  return { ...row, items };
}

async function getByReference(ref, userId){
  const row = await db('quotations').where({ reference: ref, user_id: userId }).first();
  if(!row) return null; return getDetailed(row.id);
}

async function listForUser(userId, { page=1, pageSize=10 }={}){
  const base = db('quotations as q')
    .select('q.*', db('quotation_items').whereRaw('quotation_id = q.id').count('* as c').as('items_count'))
    .where({ user_id: userId })
    .orderBy('q.id','desc');
  const rows = await base.clone().limit(pageSize).offset((page-1)*pageSize);
  const [{ c }] = await base.clone().clearSelect().count({ c: '*' });
  return { page, pageSize, total: Number(c)||0, data: rows };
}

async function listAll({ page=1, pageSize=20, status, user_id }={}){
  const base = db('quotations as q')
    .leftJoin('users as u', 'u.id', 'q.user_id')
    .select('q.*', 'u.name as user_name', 'u.email as user_email', db('quotation_items').whereRaw('quotation_id = q.id').count('* as c').as('items_count'));
  if(status) base.where({ status });
  if(user_id) base.where({ user_id });
  base.orderBy('q.id','desc');
  const rows = await base.clone().limit(pageSize).offset((page-1)*pageSize);
  const countBase = db('quotations'); if(status) countBase.where({ status }); if(user_id) countBase.where({ user_id });
  const [{ c }] = await countBase.count({ c: '*' });
  return { page, pageSize, total: Number(c)||0, data: rows };
}

async function reply(id, { logistics_amount=0, discount_amount=0, allowed_payment_methods, notes_admin }){
  const q = await db('quotations').where({ id }).first();
  if(!q) throw new Error('Not found');
  if(q.status !== 'REQUESTED') throw new Error('Cannot reply in current status');
  const subtotal = Number(q.subtotal_amount)||0;
  const logistics = Number(logistics_amount)||0;
  const discount = Number(discount_amount)||0;
  const total = Math.max(0, subtotal + logistics - discount);
  let methods = null;
  if (allowed_payment_methods){
    const arr = Array.isArray(allowed_payment_methods)? allowed_payment_methods : String(allowed_payment_methods).split(',');
    const clean = [...new Set(arr.map(s=> s.trim().toLowerCase()).filter(v=> ALLOWED_METHODS.includes(v)))];
    methods = clean.join(',') || null;
  }
  await db('quotations').where({ id }).update({
    logistics_amount: logistics,
    discount_amount: discount,
    total_amount: total,
    allowed_payment_methods: methods,
    notes_admin: notes_admin || null,
    status: 'REPLIED',
    replied_at: new Date()
  });
  return getDetailed(id);
}

async function markPaid(id){
  const q = await db('quotations').where({ id }).first();
  if(!q) throw new Error('Not found');
  if(q.status !== 'REPLIED') throw new Error('Not in payable state');
  await db('quotations').where({ id }).update({ status:'PAID', paid_at: new Date() });
  return getDetailed(id);
}

async function cancel(id){
  const q = await db('quotations').where({ id }).first();
  if(!q) throw new Error('Not found');
  if(q.status === 'PAID') throw new Error('Already paid');
  await db('quotations').where({ id }).update({ status:'CANCELLED' });
  return getDetailed(id);
}

module.exports = { createRequest, getDetailed, getByReference, listForUser, listAll, reply, markPaid, cancel, ALLOWED_METHODS };
