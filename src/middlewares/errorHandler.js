/**
 * Centralized Error Handler Middleware
 */

function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]:', err);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
  });
}

function notFoundHandler(req, res) {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: `API Route ${req.method} ${req.originalUrl} not found.`
    });
  }
  res.status(404).sendFile(require('path').join(__dirname, '..', '..', 'public', 'index.html'));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
