function notFound(req, res, next) {
  res.status(404).json({ message: 'Not Found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Uploaded file is too large' });
  }
  if (err && /Unsupported file type/i.test(err.message || '')) {
    return res.status(415).json({ message: 'Unsupported file type', filename: err?.file?.originalname || undefined });
  }
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Server Error' });
}

module.exports = { notFound, errorHandler };
