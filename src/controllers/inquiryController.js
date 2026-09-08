const { readDb, saveDb } = require('../config/db');

class InquiryController {
  /**
   * Submit customer contact inquiry (Public)
   */
  static async submit(req, res) {
    try {
      const { name, email, phone, subject, message } = req.body;
      const db = readDb();

      const newInquiry = {
        id: `INQ-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : '',
        subject: subject ? subject.trim() : 'General Inquiry',
        message: message.trim(),
        status: 'unread',
        createdAt: new Date().toISOString()
      };

      if (!db.inquiries) db.inquiries = [];
      db.inquiries.unshift(newInquiry);
      saveDb(db);

      res.status(201).json({
        success: true,
        inquiry: newInquiry,
        message: 'Your inquiry has been submitted! Our support team will contact you shortly.'
      });
    } catch (err) {
      console.error('Error saving inquiry:', err);
      res.status(500).json({ success: false, message: 'Server error submitting inquiry.' });
    }
  }

  /**
   * Get all inquiries (Admin)
   */
  static async getAll(req, res) {
    try {
      const db = readDb();
      res.json({
        success: true,
        inquiries: db.inquiries || []
      });
    } catch (err) {
      console.error('Error fetching inquiries:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving inquiries.' });
    }
  }

  /**
   * Mark inquiry as read / resolved (Admin)
   */
  static async markStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const db = readDb();

      const inquiry = (db.inquiries || []).find(i => i.id === id);
      if (!inquiry) {
        return res.status(404).json({ success: false, message: 'Inquiry not found.' });
      }

      inquiry.status = status || 'read';
      saveDb(db);

      res.json({
        success: true,
        inquiry,
        message: 'Inquiry status updated.'
      });
    } catch (err) {
      console.error('Error updating inquiry:', err);
      res.status(500).json({ success: false, message: 'Server error updating inquiry.' });
    }
  }
}

module.exports = InquiryController;
