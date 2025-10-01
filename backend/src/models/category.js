const db = require('../config/db');
const TABLE = 'categories';
module.exports = {
  TABLE,
  list: () => db(TABLE).select('*').orderBy('id', 'desc'),
  create: (data) => db(TABLE).insert(data),
  update: (id, data) => db(TABLE).where({ id }).update(data),
  remove: (id) => db(TABLE).where({ id }).del()
};
