const Joi = require('joi');

// Clamp and normalize pagination parameters
function parsePage(query, defaults = { page: 1, pageSize: 20, maxPageSize: 100 }) {
  let page = Number(query.page || defaults.page);
  let pageSize = Number(query.pageSize || defaults.pageSize);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaults.pageSize;
  if (pageSize > defaults.maxPageSize) pageSize = defaults.maxPageSize;
  return { page, pageSize };
}

// Generic middleware factory for validating req parts
function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.query) {
        const { value, error } = schemas.query.validate(req.query, { abortEarly: false, stripUnknown: true });
        if (error) return res.status(400).json({ message: 'Invalid query', details: error.details.map(d => d.message) });
        req.query = value;
      }
      if (schemas.params) {
        const { value, error } = schemas.params.validate(req.params, { abortEarly: false, stripUnknown: true });
        if (error) return res.status(400).json({ message: 'Invalid params', details: error.details.map(d => d.message) });
        req.params = value;
      }
      if (schemas.body) {
        const { value, error } = schemas.body.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) return res.status(400).json({ message: 'Invalid body', details: error.details.map(d => d.message) });
        req.body = value;
      }
      next();
    } catch (e) { next(e); }
  };
}

module.exports = { parsePage, validate, Joi };
