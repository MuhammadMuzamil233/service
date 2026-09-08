/**
 * HTTP Request Logger Middleware
 */

function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    // Highlight status
    const statusText = status >= 400 ? `⚠️ ${status}` : `✅ ${status}`;
    if (!url.startsWith('/css') && !url.startsWith('/js') && !url.includes('.')) {
      console.log(`[HTTP] ${method} ${url} - ${statusText} (${duration}ms)`);
    }
  });

  next();
}

module.exports = requestLogger;
