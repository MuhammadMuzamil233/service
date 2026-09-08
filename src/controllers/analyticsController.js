const TicketService = require('../services/ticketService');
const { readDb } = require('../config/db');

class AnalyticsController {
  /**
   * Get complete admin dashboard analytics
   */
  static async getOverview(req, res) {
    try {
      const ticketAnalytics = TicketService.getAnalytics();
      const db = readDb();

      const liveChatsCount = Object.values(db.chats || {}).filter(s => s.status === 'live').length;
      const totalChatsCount = Object.keys(db.chats || {}).length;
      const unreadInquiries = (db.inquiries || []).filter(i => i.status === 'unread').length;

      res.json({
        success: true,
        analytics: {
          ...ticketAnalytics,
          chats: {
            total: totalChatsCount,
            live: liveChatsCount
          },
          inquiries: {
            total: (db.inquiries || []).length,
            unread: unreadInquiries
          }
        }
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving analytics.' });
    }
  }
}

module.exports = AnalyticsController;
