const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');
const { validateTicket } = require('../middlewares/validation');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Customer Routes
router.post('/', validateTicket, TicketController.create);
router.get('/my/bookings', authenticateToken, TicketController.getMyBookings);
router.get('/:id', TicketController.getById);

module.exports = router;
