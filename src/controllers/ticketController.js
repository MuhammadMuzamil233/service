const jwt = require('jsonwebtoken');
const TicketService = require('../services/ticketService');
const { broadcastNewTicket, broadcastTicketUpdated } = require('../services/socketService');
const { readDb } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'proservice_super_secret_jwt_key_2026_secure';

class TicketController {
  /**
   * Create new ticket (Enforces authenticated user)
   */
  static async create(req, res) {
    try {
      // Check authentication: customer or admin
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      let authUser = null;
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const db = readDb();
          authUser = (db.users || []).find(u => u.id === decoded.id || (u.email && u.email.toLowerCase() === (decoded.email || '').toLowerCase()));
        } catch (e) {
          // Token invalid or expired
        }
      }

      // If not authenticated, reject booking
      if (!authUser) {
        return res.status(401).json({
          success: false,
          message: 'Please sign in with your Gmail account to book a technician.'
        });
      }

      const ticketPayload = {
        ...req.body,
        customerId: authUser.role === 'customer' ? authUser.id : (req.body.customerId || null),
        customerEmail: authUser.role === 'customer' ? authUser.email : (req.body.customerEmail || null)
      };

      const ticket = TicketService.createTicket(ticketPayload);

      // Broadcast real-time event to Admin Room
      broadcastNewTicket(ticket);

      res.status(201).json({
        success: true,
        ticket,
        message: 'Service request registered successfully! Technician will contact you shortly.'
      });
    } catch (err) {
      console.error('Error creating ticket:', err);
      res.status(500).json({
        success: false,
        message: 'Server error creating ticket.'
      });
    }
  }

  /**
   * Get single ticket by ID (Customer Tracking)
   */
  static async getById(req, res) {
    try {
      const ticketId = req.params.id;
      const ticket = TicketService.getTicketById(ticketId);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${ticketId} not found.`
        });
      }

      res.json({
        success: true,
        ticket
      });
    } catch (err) {
      console.error('Error fetching ticket:', err);
      res.status(500).json({
        success: false,
        message: 'Server error retrieving ticket.'
      });
    }
  }

  /**
   * Get all tickets (Admin Dashboard)
   */
  static async getAll(req, res) {
    try {
      const { status, serviceType, urgency, search, page, limit } = req.query;
      const result = TicketService.getAllTickets({
        status,
        serviceType,
        urgency,
        search,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 200
      });

      res.json({
        success: true,
        tickets: result.tickets,
        pagination: result.pagination
      });
    } catch (err) {
      console.error('Error listing tickets:', err);
      res.status(500).json({
        success: false,
        message: 'Server error retrieving tickets list.'
      });
    }
  }

  /**
   * Update ticket status, technician assignment, notes (Admin)
   */
  static async update(req, res) {
    try {
      const ticketId = req.params.id;
      const updatedTicket = TicketService.updateTicket(ticketId, req.body);

      if (!updatedTicket) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${ticketId} not found.`
        });
      }

      // Broadcast real-time update
      broadcastTicketUpdated(updatedTicket);

      res.json({
        success: true,
        ticket: updatedTicket,
        message: 'Ticket updated successfully.'
      });
    } catch (err) {
      console.error('Error updating ticket:', err);
      res.status(500).json({
        success: false,
        message: 'Server error updating ticket.'
      });
    }
  }

  /**
   * Delete ticket (Admin)
   */
  static async delete(req, res) {
    try {
      const ticketId = req.params.id;
      const deleted = TicketService.deleteTicket(ticketId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: `Ticket ${ticketId} not found.`
        });
      }

      res.json({
        success: true,
        message: `Ticket ${ticketId} deleted successfully.`
      });
    } catch (err) {
      console.error('Error deleting ticket:', err);
      res.status(500).json({
        success: false,
        message: 'Server error deleting ticket.'
      });
    }
  }

  /**
   * Get authenticated customer's own bookings
   */
  static async getMyBookings(req, res) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const db = readDb();
      const cleanEmail = (req.user.email || '').toLowerCase().trim();
      const customerId = req.user.id;
      const customerPhone = req.user.phone;

      const tickets = (db.tickets || []).filter(t => 
        (t.customerId && t.customerId === customerId) ||
        (t.customerEmail && t.customerEmail.toLowerCase().trim() === cleanEmail) ||
        (customerPhone && t.phone === customerPhone)
      );

      res.json({
        success: true,
        tickets: tickets.reverse()
      });
    } catch (err) {
      console.error('Error getting customer bookings:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving bookings.' });
    }
  }

  /**
   * Get ticket statistics / analytics
   */
  static async getStats(req, res) {
    try {
      const stats = TicketService.getAnalytics();
      res.json({
        success: true,
        stats
      });
    } catch (err) {
      console.error('Error getting stats:', err);
      res.status(500).json({
        success: false,
        message: 'Server error getting ticket statistics.'
      });
    }
  }
}

module.exports = TicketController;
