const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staffController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// All staff endpoints require authentication
router.use(authenticateToken);

router.get('/my-tickets', StaffController.getMyTickets);
router.get('/tickets/:id', StaffController.getTicketDetails);
router.patch('/tickets/:id/status', StaffController.updateTicketStatus);

module.exports = router;
