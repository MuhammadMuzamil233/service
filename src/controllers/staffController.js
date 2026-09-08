const { readDb, saveDb } = require('../config/db');
const { broadcastTicketUpdated, broadcastJobAssigned } = require('../services/socketService');

class StaffController {
  /**
   * Get all tickets assigned to the logged-in staff member
   */
  static async getMyTickets(req, res) {
    try {
      const db = readDb();
      const techId = req.user.technicianId;
      const userName = req.user.name;

      let myTickets = (db.tickets || []).filter(ticket => {
        if (techId && ticket.assignedTechId === techId) return true;
        if (!ticket.assignedTechId && userName && ticket.assignedTo === userName) return true;
        return false;
      });

      // Find technician profile
      const techProfile = (db.technicians || []).find(t => t.id === techId) || {
        id: techId || 'TECH-000',
        name: userName,
        specialty: req.user.specialty || 'General'
      };

      // Filter query support
      const { status } = req.query;
      let filteredTickets = myTickets;
      if (status && status !== 'all') {
        filteredTickets = myTickets.filter(t => t.status.toLowerCase() === status.toLowerCase());
      }

      // Compute quick stats
      const stats = {
        total: myTickets.length,
        assigned: myTickets.filter(t => t.status === 'Assigned').length,
        inProgress: myTickets.filter(t => t.status === 'In Progress').length,
        completed: myTickets.filter(t => t.status === 'Completed').length,
        emergency: myTickets.filter(t => t.urgency === 'Emergency' && t.status !== 'Completed').length
      };

      res.json({
        success: true,
        technician: techProfile,
        stats,
        tickets: filteredTickets
      });
    } catch (err) {
      console.error('Error fetching staff tickets:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving staff jobs.' });
    }
  }

  /**
   * Get detailed view of an assigned ticket
   */
  static async getTicketDetails(req, res) {
    try {
      const { id } = req.params;
      const db = readDb();
      const techId = req.user.technicianId;
      const ticket = (db.tickets || []).find(t => t.id.toUpperCase() === id.trim().toUpperCase());

      if (!ticket) {
        return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }

      // Strict Isolation Check: Technician can only view their own assigned job!
      if (req.user.role !== 'admin' && ticket.assignedTechId !== techId && ticket.assignedTo !== req.user.name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. This job is not assigned to your staff account.'
        });
      }

      res.json({
        success: true,
        ticket
      });
    } catch (err) {
      console.error('Error fetching ticket details:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving ticket details.' });
    }
  }

  /**
   * Staff updates ticket status (e.g. Accept/Start Job, Mark Completed)
   */
  static async updateTicketStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, notes, partsReplaced, actualCost } = req.body;
      const db = readDb();
      const index = (db.tickets || []).findIndex(t => t.id.toUpperCase() === id.trim().toUpperCase());

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Ticket not found.' });
      }

      const ticket = db.tickets[index];

      // Strict Isolation Check: Staff can only update their own assigned job!
      if (req.user.role !== 'admin' && ticket.assignedTechId !== req.user.technicianId && ticket.assignedTo !== req.user.name) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only update jobs assigned to you.'
        });
      }
      const now = new Date().toISOString();
      const staffName = req.user.name || 'Technician';

      if (status && status !== ticket.status) {
        ticket.status = status;
        if (!ticket.timeline) ticket.timeline = [];
        
        let timelineNote = `Status updated to ${status} by ${staffName}.`;
        if (status === 'In Progress') {
          timelineNote = `Technician ${staffName} accepted job and is on the way / working.`;
        } else if (status === 'Completed') {
          timelineNote = `Job successfully completed by ${staffName}.`;
        }

        ticket.timeline.push({
          status,
          timestamp: now,
          note: notes ? `${timelineNote} Note: ${notes}` : timelineNote
        });
      }

      if (notes !== undefined) {
        ticket.notes = notes;
      }
      if (partsReplaced !== undefined) {
        ticket.partsReplaced = partsReplaced;
      }
      if (actualCost !== undefined && !isNaN(Number(actualCost))) {
        ticket.estimatedCost = Number(actualCost);
      }

      ticket.updatedAt = now;
      db.tickets[index] = ticket;

      // If completed, increment technician's completed jobs counter
      if (status === 'Completed') {
        const tech = (db.technicians || []).find(t => t.id === ticket.assignedTechId || t.name === ticket.assignedTo);
        if (tech) {
          tech.jobsCompleted = (tech.jobsCompleted || 0) + 1;
        }
      }

      saveDb(db);

      // Real-time broadcast to all clients (Admin desk + Customer tracking)
      broadcastTicketUpdated(ticket);

      res.json({
        success: true,
        ticket,
        message: `Job ${ticket.id} status updated to "${ticket.status}" successfully!`
      });
    } catch (err) {
      console.error('Error updating staff job status:', err);
      res.status(500).json({ success: false, message: 'Server error updating job status.' });
    }
  }
}

module.exports = StaffController;
