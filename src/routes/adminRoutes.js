const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticketController');
const ChatController = require('../controllers/chatController');
const AnalyticsController = require('../controllers/analyticsController');
const InquiryController = require('../controllers/inquiryController');
const TechnicianController = require('../controllers/technicianController');
const { optionalAuth } = require('../middlewares/authMiddleware');

// Ticket Management
router.get('/tickets', optionalAuth, TicketController.getAll);
router.patch('/tickets/:id', optionalAuth, TicketController.update);
router.delete('/tickets/:id', optionalAuth, TicketController.delete);
router.get('/tickets/stats', optionalAuth, TicketController.getStats);

// Chat Sessions Management
router.get('/chats', optionalAuth, ChatController.getAll);
router.get('/chats/:sessionId', optionalAuth, ChatController.getById);
router.delete('/chats/:sessionId', optionalAuth, ChatController.delete);

// Dashboard Analytics
router.get('/analytics', optionalAuth, AnalyticsController.getOverview);

// Inquiries Inbox
router.get('/inquiries', optionalAuth, InquiryController.getAll);
router.patch('/inquiries/:id', optionalAuth, InquiryController.markStatus);

// Technicians Management
router.get('/technicians', optionalAuth, TechnicianController.getAll);
router.post('/technicians', optionalAuth, TechnicianController.create);
router.patch('/technicians/:id', optionalAuth, TechnicianController.update);
router.delete('/technicians/:id', optionalAuth, TechnicianController.delete);

module.exports = router;
