const db = require('../config/db');
const TABLE = 'products';

async function list({ q, category_id, stock_status, sort, page = 1, pageSize = 20 }) {
  const query = db(TABLE).select('*').where({ active: 1 });
  if (q) query.andWhere('title', 'like', `%${q}%`);
  if (category_id) query.andWhere('category_id', category_id);
  if (stock_status) query.andWhere('stock_status', stock_status);
  const offset = (page - 1) * pageSize;
  // Sorting
  if (sort === 'price_asc') query.orderBy('price_per_unit', 'asc');
  else if (sort === 'price_desc') query.orderBy('price_per_unit', 'desc');
  else query.orderBy('id', 'desc'); // newest default
  const items = await query.limit(pageSize).offset(offset);
  return items;
}

function get(id) { return db(TABLE).where({ id }).first(); }
function create(data) { return db(TABLE).insert(data); }
function update(id, data) { return db(TABLE).where({ id }).update(data); }
function remove(id) { return db(TABLE).where({ id }).update({ active: 0 }); }

function getDiscounts(product_id) { return db('bulk_discounts').where({ product_id }).orderBy('min_qty'); }

module.exports = { TABLE, list, get, create, update, remove, getDiscounts };
