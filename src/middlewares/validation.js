/**
 * Request Validation Middlewares
 */

function validateTicket(req, res, next) {
  const { customerName, phone, serviceType, address } = req.body;

  const errors = [];
  if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
    errors.push('Customer name is required.');
  }
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    errors.push('Phone number is required.');
  }
  if (!serviceType || typeof serviceType !== 'string' || !serviceType.trim()) {
    errors.push('Service type is required.');
  }
  if (!address || typeof address !== 'string' || !address.trim()) {
    errors.push('Service address is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors.join(' '),
      errors
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }
  next();
}

function validateTechnician(req, res, next) {
  const { name, phone, specialty } = req.body;
  if (!name || !phone || !specialty) {
    return res.status(400).json({
      success: false,
      message: 'Technician name, phone, and specialty are required.'
    });
  }
  next();
}

function validateInquiry(req, res, next) {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and message are required.'
    });
  }
  next();
}

function validateReview(req, res, next) {
  const { ticketId, customerName, rating } = req.body;
  if (!ticketId || !customerName || rating === undefined) {
    return res.status(400).json({
      success: false,
      message: 'Ticket ID, customer name, and rating (1-5) are required.'
    });
  }
  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({
      success: false,
      message: 'Rating must be a number between 1 and 5.'
    });
  }
  next();
}

module.exports = {
  validateTicket,
  validateLogin,
  validateTechnician,
  validateInquiry,
  validateReview
};
