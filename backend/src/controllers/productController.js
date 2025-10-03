const Products = require('../models/product');

exports.list = async (req, res) => {
  const { q, category_id, stock_status, sort, page, pageSize } = req.query;
  const data = await Products.list({ q, category_id, stock_status, sort, page: Number(page) || 1, pageSize: Number(pageSize) || 20 });
  res.json({ data });
};

exports.get = async (req, res) => {
  const { id } = req.params;
  const product = await Products.get(id);
  if (!product) return res.status(404).json({ message: 'Not found' });
  const discounts = await Products.getDiscounts(id);
  res.json({ product, discounts });
};

exports.create = async (req, res) => {
  const { title, description, moq, price_per_unit, stock_status, category_id } = req.body;
  if (!title || !price_per_unit) return res.status(400).json({ message: 'Missing fields' });
  const images = (req.files?.images || []).map(f => `/uploads/${f.filename}`);
  const videos = (req.files?.videos || []).map(f => `/uploads/${f.filename}`);
  const [id] = await Products.create({ title, description, moq, price_per_unit, stock_status, category_id, images: JSON.stringify(images), videos: JSON.stringify(videos) });
  res.status(201).json({ id });
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { title, description, moq, price_per_unit, stock_status, category_id, active } = req.body;
  await Products.update(id, { title, description, moq, price_per_unit, stock_status, category_id, active });
  res.json({ message: 'updated' });
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  await Products.remove(id);
  res.json({ message: 'archived' });
};
