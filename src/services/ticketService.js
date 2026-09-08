const { readDb, saveDb } = require('../config/db');

class TicketService {
  /**
   * Create a new ticket
   */
  static createTicket({ customerName, phone, serviceType, address, problemDescription, urgency, assignedTechId, assignedTo, notes, estimatedCost, customerId, customerEmail }) {
    const db = readDb();

    // Generate unique Ticket ID
    let ticketId;
    let attempts = 0;
    do {
      const randomCode = Math.floor(10000 + Math.random() * 90000);
      ticketId = `TKT-${randomCode}`;
      attempts++;
    } while (db.tickets.some(t => t.id === ticketId) && attempts < 100);

    // Match service for proper title and base cost
    const matchedService = (db.services || []).find(s => s.id === serviceType);
    const serviceName = matchedService ? matchedService.title : serviceType;
    const basePrice = matchedService ? matchedService.basePriceNum || 1500 : 1500;

    // Check if explicit technician was specified by Admin, else try auto-matching
    let targetTech = null;
    if (assignedTechId) {
      targetTech = (db.technicians || []).find(tech => tech.id === assignedTechId);
    } else if (assignedTo) {
      targetTech = (db.technicians || []).find(tech => tech.name === assignedTo);
    } else {
      targetTech = (db.technicians || []).find(tech => tech.specialty === serviceType && tech.status === 'available');
    }

    const assignedName = targetTech ? targetTech.name : (assignedTo || null);
    const assignedId = targetTech ? targetTech.id : (assignedTechId || null);

    const now = new Date().toISOString();
    const newTicket = {
      id: ticketId,
      customerId: customerId || null,
      customerEmail: customerEmail ? customerEmail.toLowerCase().trim() : null,
      customerName: customerName.trim(),
      phone: phone.trim(),
      serviceType,
      serviceName,
      address: address.trim(),
      problemDescription: (problemDescription || '').trim() || 'No additional details provided.',
      urgency: urgency || 'Standard',
      status: targetTech || assignedName ? 'Assigned' : 'Pending',
      assignedTo: assignedName,
      assignedTechId: assignedId,
      estimatedCost: estimatedCost ? Number(estimatedCost) : basePrice,
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          status: 'Pending',
          timestamp: now,
          note: 'Service booking created and verified.'
        },
        ...(targetTech || assignedName ? [{
          status: 'Assigned',
          timestamp: now,
          note: `Assigned to ${assignedName}${targetTech ? ` (${targetTech.specialtyLabel || targetTech.specialty})` : ''}.`
        }] : [])
      ],
      notes: notes || (targetTech 
        ? `Technician ${targetTech.name} assigned. Contact: ${targetTech.phone}`
        : 'Service request registered. Waiting for technician assignment.')
    };

    // If technician assigned, ensure jobsCompleted counter exists
    if (targetTech) {
      targetTech.jobsCompleted = (targetTech.jobsCompleted || 0);
    }

    db.tickets.unshift(newTicket);
    saveDb(db);

    return newTicket;
  }

  /**
   * Get ticket by ID
   */
  static getTicketById(id) {
    if (!id) return null;
    const db = readDb();
    const cleanId = id.trim().toUpperCase();
    return db.tickets.find(t => t.id === cleanId) || null;
  }

  /**
   * Get all tickets with filtering and search
   */
  static getAllTickets({ status, serviceType, urgency, search, page = 1, limit = 50 } = {}) {
    const db = readDb();
    let tickets = [...(db.tickets || [])];

    // Filter by status
    if (status && status !== 'all') {
      tickets = tickets.filter(t => t.status.toLowerCase() === status.toLowerCase());
    }

    // Filter by service
    if (serviceType && serviceType !== 'all') {
      tickets = tickets.filter(t => t.serviceType === serviceType);
    }

    // Filter by urgency
    if (urgency && urgency !== 'all') {
      tickets = tickets.filter(t => t.urgency.toLowerCase() === urgency.toLowerCase());
    }

    // Search query across ID, customer, phone, address, problem
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      tickets = tickets.filter(t => 
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q)) ||
        (t.serviceName && t.serviceName.toLowerCase().includes(q)) ||
        (t.address && t.address.toLowerCase().includes(q))
      );
    }

    const total = tickets.length;
    const startIndex = (page - 1) * limit;
    const paginatedTickets = tickets.slice(startIndex, startIndex + limit);

    return {
      tickets: paginatedTickets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update an existing ticket
   */
  static updateTicket(id, updates) {
    const db = readDb();
    const cleanId = id.trim().toUpperCase();
    const index = db.tickets.findIndex(t => t.id === cleanId);

    if (index === -1) return null;

    const ticket = db.tickets[index];
    const now = new Date().toISOString();
    let timelineUpdated = false;

    // Status change
    if (updates.status && updates.status !== ticket.status) {
      ticket.status = updates.status;
      if (!ticket.timeline) ticket.timeline = [];
      ticket.timeline.push({
        status: updates.status,
        timestamp: now,
        note: updates.notes || `Status changed to ${updates.status}`
      });
      timelineUpdated = true;
    }

    // Assigning technician
    if (updates.assignedTo !== undefined && updates.assignedTo !== ticket.assignedTo) {
      ticket.assignedTo = updates.assignedTo;
      // Also update assignedTechId if tech exists
      const tech = (db.technicians || []).find(t => t.name === updates.assignedTo || t.id === updates.assignedTechId);
      if (tech) {
        ticket.assignedTechId = tech.id;
      }
      if (!timelineUpdated) {
        if (!ticket.timeline) ticket.timeline = [];
        ticket.timeline.push({
          status: ticket.status,
          timestamp: now,
          note: `Technician updated to ${updates.assignedTo || 'Unassigned'}`
        });
      }
    }

    if (updates.assignedTechId !== undefined) {
      ticket.assignedTechId = updates.assignedTechId;
      const tech = (db.technicians || []).find(t => t.id === updates.assignedTechId);
      if (tech) ticket.assignedTo = tech.name;
    }

    if (updates.notes !== undefined) ticket.notes = updates.notes;
    if (updates.estimatedCost !== undefined) ticket.estimatedCost = Number(updates.estimatedCost);

    ticket.updatedAt = now;
    db.tickets[index] = ticket;
    saveDb(db);

    return ticket;
  }

  /**
   * Delete a ticket
   */
  static deleteTicket(id) {
    const db = readDb();
    const cleanId = id.trim().toUpperCase();
    const index = db.tickets.findIndex(t => t.id === cleanId);
    if (index === -1) return false;

    db.tickets.splice(index, 1);
    saveDb(db);
    return true;
  }

  /**
   * Get ticket dashboard analytics
   */
  static getAnalytics() {
    const db = readDb();
    const tickets = db.tickets || [];
    const technicians = db.technicians || [];
    const reviews = db.reviews || [];

    const totalTickets = tickets.length;
    const pending = tickets.filter(t => t.status === 'Pending').length;
    const assigned = tickets.filter(t => t.status === 'Assigned').length;
    const inProgress = tickets.filter(t => t.status === 'In Progress').length;
    const completed = tickets.filter(t => t.status === 'Completed').length;
    const cancelled = tickets.filter(t => t.status === 'Cancelled').length;
    const emergency = tickets.filter(t => t.urgency === 'Emergency').length;

    // Service Breakdown
    const serviceBreakdown = {};
    tickets.forEach(t => {
      serviceBreakdown[t.serviceType] = (serviceBreakdown[t.serviceType] || 0) + 1;
    });

    // Revenue calculations
    const estimatedTotalRevenue = tickets.reduce((acc, t) => acc + (t.estimatedCost || 1500), 0);
    const completedRevenue = tickets
      .filter(t => t.status === 'Completed')
      .reduce((acc, t) => acc + (t.estimatedCost || 1500), 0);

    // Average rating
    const avgRating = reviews.length > 0 
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
      : '5.0';

    return {
      summary: {
        totalTickets,
        pending,
        assigned,
        inProgress,
        completed,
        cancelled,
        emergency,
        activeTechnicians: technicians.filter(t => t.status === 'available').length,
        totalTechnicians: technicians.length,
        totalReviews: reviews.length,
        avgRating: Number(avgRating),
        estimatedTotalRevenue,
        completedRevenue
      },
      serviceBreakdown,
      recentTickets: tickets.slice(0, 5)
    };
  }
}

module.exports = TicketService;
