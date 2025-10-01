const Categories = require('../models/category');

exports.list = async (req, res) => {
  const data = await Categories.list();
  res.json({ data });
};

exports.create = async (req, res) => {
  const { name, parent_id } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });
  const [id] = await Categories.create({ name, parent_id: parent_id || null });
  res.status(201).json({ id });
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, parent_id } = req.body;
  await Categories.update(id, { name, parent_id: parent_id || null });
  res.json({ message: 'updated' });
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  await Categories.remove(id);
  res.json({ message: 'deleted' });
};
