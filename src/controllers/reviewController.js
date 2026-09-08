const { readDb, saveDb } = require('../config/db');

class ReviewController {
  /**
   * Get all customer reviews
   */
  static async getAll(req, res) {
    try {
      const db = readDb();
      const reviews = (db.reviews || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.json({
        success: true,
        reviews
      });
    } catch (err) {
      console.error('Error fetching reviews:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving reviews.' });
    }
  }

  /**
   * Submit customer review for completed ticket
   */
  static async submit(req, res) {
    try {
      const { ticketId, customerName, serviceType, rating, comment } = req.body;
      const db = readDb();

      const newReview = {
        id: `REV-${Math.floor(100 + Math.random() * 900)}`,
        ticketId: ticketId.trim().toUpperCase(),
        customerName: customerName.trim(),
        serviceType: serviceType || 'general',
        rating: Number(rating),
        comment: (comment || '').trim(),
        createdAt: new Date().toISOString()
      };

      if (!db.reviews) db.reviews = [];
      db.reviews.unshift(newReview);
      saveDb(db);

      res.status(201).json({
        success: true,
        review: newReview,
        message: 'Thank you for your feedback!'
      });
    } catch (err) {
      console.error('Error saving review:', err);
      res.status(500).json({ success: false, message: 'Server error submitting review.' });
    }
  }
}

module.exports = ReviewController;
