const { readDb, saveDb } = require('../config/db');

class ServiceController {
  /**
   * Get all services (Public & Admin)
   */
  static async getAll(req, res) {
    try {
      const db = readDb();
      res.json({
        success: true,
        services: db.services || []
      });
    } catch (err) {
      console.error('Error fetching services:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving services.' });
    }
  }

  /**
   * Get single service by ID
   */
  static async getById(req, res) {
    try {
      const db = readDb();
      const service = (db.services || []).find(s => s.id === req.params.id);

      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found.' });
      }

      res.json({ success: true, service });
    } catch (err) {
      console.error('Error fetching service:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving service.' });
    }
  }

  /**
   * Create new service (Admin)
   */
  static async create(req, res) {
    try {
      const { id, title, urduTitle, icon, badge, shortDesc, features, startingPrice, basePriceNum, turnaround, emergencyAvailable } = req.body;
      const db = readDb();

      if (!id || !title) {
        return res.status(400).json({ success: false, message: 'Service ID and title are required.' });
      }

      if (db.services.some(s => s.id === id)) {
        return res.status(400).json({ success: false, message: `Service with ID '${id}' already exists.` });
      }

      const newService = {
        id: id.toLowerCase().trim(),
        title: title.trim(),
        urduTitle: urduTitle || '',
        icon: icon || 'tool',
        badge: badge || 'Standard',
        shortDesc: shortDesc || '',
        features: Array.isArray(features) ? features : [],
        startingPrice: startingPrice || 'Rs. 1,000',
        basePriceNum: basePriceNum ? Number(basePriceNum) : 1000,
        turnaround: turnaround || 'Same Day',
        emergencyAvailable: !!emergencyAvailable
      };

      db.services.push(newService);
      saveDb(db);

      res.status(201).json({
        success: true,
        service: newService,
        message: 'Service added successfully.'
      });
    } catch (err) {
      console.error('Error adding service:', err);
      res.status(500).json({ success: false, message: 'Server error creating service.' });
    }
  }

  /**
   * Update service (Admin)
   */
  static async update(req, res) {
    try {
      const serviceId = req.params.id;
      const db = readDb();
      const index = db.services.findIndex(s => s.id === serviceId);

      if (index === -1) {
        return res.status(404).json({ success: false, message: 'Service not found.' });
      }

      const current = db.services[index];
      const { title, urduTitle, icon, badge, shortDesc, features, startingPrice, basePriceNum, turnaround, emergencyAvailable } = req.body;

      if (title) current.title = title.trim();
      if (urduTitle !== undefined) current.urduTitle = urduTitle;
      if (icon) current.icon = icon;
      if (badge !== undefined) current.badge = badge;
      if (shortDesc !== undefined) current.shortDesc = shortDesc;
      if (features) current.features = Array.isArray(features) ? features : current.features;
      if (startingPrice) current.startingPrice = startingPrice;
      if (basePriceNum !== undefined) current.basePriceNum = Number(basePriceNum);
      if (turnaround) current.turnaround = turnaround;
      if (emergencyAvailable !== undefined) current.emergencyAvailable = !!emergencyAvailable;

      db.services[index] = current;
      saveDb(db);

      res.json({
        success: true,
        service: current,
        message: 'Service updated successfully.'
      });
    } catch (err) {
      console.error('Error updating service:', err);
      res.status(500).json({ success: false, message: 'Server error updating service.' });
    }
  }
}

module.exports = ServiceController;
