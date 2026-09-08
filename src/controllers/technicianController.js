const { readDb, saveDb } = require('../config/db');

class TechnicianController {
  /**
   * Get all technicians (Optionally filtered by specialty or status)
   */
  static async getAll(req, res) {
    try {
      const { specialty, status } = req.query;
      const db = readDb();
      let technicians = [...(db.technicians || [])];

      if (specialty && specialty !== 'all') {
        technicians = technicians.filter(t => t.specialty === specialty);
      }

      if (status && status !== 'all') {
        technicians = technicians.filter(t => t.status === status);
      }

      // Add active jobs count for each tech
      const tickets = db.tickets || [];
      const enriched = technicians.map(tech => {
        const activeJobs = tickets.filter(t => 
          (t.assignedTechId === tech.id || t.assignedTo === tech.name) &&
          (t.status === 'Assigned' || t.status === 'In Progress')
        ).length;
        return {
          ...tech,
          activeJobs
        };
      });

      res.json({
        success: true,
        technicians: enriched
      });
    } catch (err) {
      console.error('Error fetching technicians:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving technicians.' });
    }
  }

  /**
   * Get single technician by ID
   */
  static async getById(req, res) {
    try {
      const db = readDb();
      const tech = (db.technicians || []).find(t => t.id === req.params.id);

      if (!tech) {
        return res.status(404).json({ success: false, message: 'Technician not found.' });
      }

      res.json({ success: true, technician: tech });
    } catch (err) {
      console.error('Error fetching technician:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving technician.' });
    }
  }

  /**
   * Create new technician
   */
  static async create(req, res) {
    try {
      const { name, phone, email, specialty, specialtyLabel, address } = req.body;
      const db = readDb();

      const newId = `TECH-${Math.floor(100 + Math.random() * 900)}`;
      const cleanEmail = email ? email.trim().toLowerCase() : `tech_${newId.toLowerCase()}@proservice.com`;
      const cleanSpecialty = (specialty || 'general').toLowerCase();

      const newTech = {
        id: newId,
        name: name.trim(),
        phone: phone.trim(),
        email: cleanEmail,
        specialty: cleanSpecialty,
        specialtyLabel: specialtyLabel || `${cleanSpecialty.toUpperCase()} Specialist`,
        rating: 5.0,
        jobsCompleted: 0,
        status: 'available',
        address: address || 'Pakistan',
        createdAt: new Date().toISOString()
      };

      // Also create login account in db.users
      const bcrypt = require('bcryptjs');
      const newUser = {
        id: `usr_${newId.toLowerCase()}`,
        name: name.trim(),
        email: cleanEmail,
        password: bcrypt.hashSync(req.body.password || 'tech123', 10),
        role: 'technician',
        technicianId: newId,
        specialty: cleanSpecialty,
        phone: phone.trim(),
        createdAt: new Date().toISOString()
      };

      if (!db.technicians) db.technicians = [];
      if (!db.users) db.users = [];

      db.technicians.push(newTech);
      db.users.push(newUser);
      saveDb(db);

      res.status(201).json({
        success: true,
        technician: newTech,
        message: `Staff member ${newTech.name} (${newId}) added successfully!`
      });
    } catch (err) {
      console.error('Error adding technician:', err);
      res.status(500).json({ success: false, message: 'Server error creating technician.' });
    }
  }

  /**
   * Update technician profile / status
   */
  static async update(req, res) {
    try {
      const techId = req.params.id;
      const db = readDb();
      const index = (db.technicians || []).findIndex(t => t.id === techId);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Technician not found.' });
      }

      const tech = db.technicians[index];
      const { name, phone, email, specialty, specialtyLabel, status, rating } = req.body;

      if (name) tech.name = name.trim();
      if (phone) tech.phone = phone.trim();
      if (email) tech.email = email.trim();
      if (specialty) tech.specialty = specialty.toLowerCase();
      if (specialtyLabel) tech.specialtyLabel = specialtyLabel;
      if (status) tech.status = status;
      if (rating !== undefined) tech.rating = Number(rating);

      tech.updatedAt = new Date().toISOString();
      db.technicians[index] = tech;

      // Sync with user account if exists
      const userIndex = (db.users || []).findIndex(u => u.technicianId === techId || u.id === `usr_${techId.toLowerCase()}`);
      if (userIndex !== -1) {
        if (name) db.users[userIndex].name = name.trim();
        if (phone) db.users[userIndex].phone = phone.trim();
        if (email) db.users[userIndex].email = email.trim();
        if (specialty) db.users[userIndex].specialty = specialty.toLowerCase();
      }

      saveDb(db);

      res.json({
        success: true,
        technician: tech,
        message: `Staff member ${tech.name} status updated to: ${tech.status.toUpperCase()}`
      });
    } catch (err) {
      console.error('Error updating technician:', err);
      res.status(500).json({ success: false, message: 'Server error updating technician.' });
    }
  }

  /**
   * Delete technician and clean up user account & active tasks
   */
  static async delete(req, res) {
    try {
      const techId = req.params.id;
      const db = readDb();
      const index = (db.technicians || []).findIndex(t => t.id === techId);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Technician not found.' });
      }

      const tech = db.technicians[index];

      // Remove from technicians
      db.technicians.splice(index, 1);

      // Remove from user accounts
      if (db.users) {
        db.users = db.users.filter(u => u.technicianId !== techId && u.id !== `usr_${techId.toLowerCase()}`);
      }

      // Reassign active jobs assigned to this technician back to Pending
      let unassignedCount = 0;
      if (db.tickets) {
        db.tickets.forEach(t => {
          if (t.assignedTechId === techId || t.assignedTo === tech.name) {
            if (t.status === 'Assigned' || t.status === 'In Progress') {
              t.status = 'Pending';
              t.assignedTechId = null;
              t.assignedTo = null;
              t.notes = (t.notes ? t.notes + '\n' : '') + `[Admin Notice: Staff member ${tech.name} removed. Reassignment required.]`;
              if (t.timeline) {
                t.timeline.push({
                  status: 'Pending',
                  timestamp: new Date().toISOString(),
                  note: `Staff member ${tech.name} was removed by Admin. Ticket returned to Pending queue.`
                });
              }
              unassignedCount++;
            }
          }
        });
      }

      saveDb(db);

      res.json({
        success: true,
        message: `Staff member "${tech.name}" (${techId}) has been deleted. ${unassignedCount > 0 ? `${unassignedCount} active job(s) returned to Pending queue.` : ''}`
      });
    } catch (err) {
      console.error('Error deleting technician:', err);
      res.status(500).json({ success: false, message: 'Server error deleting technician.' });
    }
  }
}

module.exports = TechnicianController;
