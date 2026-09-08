const { readDb, saveDb } = require('../config/db');

class ChatController {
  /**
   * Get all chat sessions (Admin)
   */
  static async getAll(req, res) {
    try {
      const db = readDb();
      const sessions = Object.values(db.chats || {}).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

      res.json({
        success: true,
        chats: sessions
      });
    } catch (err) {
      console.error('Error fetching chats:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving chats.' });
    }
  }

  /**
   * Get specific chat session
   */
  static async getById(req, res) {
    try {
      const sessionId = req.params.sessionId;
      const db = readDb();
      const session = db.chats ? db.chats[sessionId] : null;

      if (!session) {
        return res.status(404).json({ success: false, message: 'Chat session not found.' });
      }

      res.json({
        success: true,
        chat: session
      });
    } catch (err) {
      console.error('Error fetching chat session:', err);
      res.status(500).json({ success: false, message: 'Server error retrieving session.' });
    }
  }

  /**
   * Delete chat session (Admin)
   */
  static async delete(req, res) {
    try {
      const sessionId = req.params.sessionId;
      const db = readDb();

      if (db.chats && db.chats[sessionId]) {
        delete db.chats[sessionId];
        saveDb(db);
        return res.json({ success: true, message: 'Chat session deleted.' });
      }

      res.status(404).json({ success: false, message: 'Chat session not found.' });
    } catch (err) {
      console.error('Error deleting chat session:', err);
      res.status(500).json({ success: false, message: 'Server error deleting session.' });
    }
  }
}

module.exports = ChatController;
