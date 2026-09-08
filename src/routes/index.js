const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const ticketRoutes = require('./ticketRoutes');
const technicianRoutes = require('./technicianRoutes');
const serviceRoutes = require('./serviceRoutes');
const reviewRoutes = require('./reviewRoutes');
const inquiryRoutes = require('./inquiryRoutes');
const adminRoutes = require('./adminRoutes');
const staffRoutes = require('./staffRoutes');

// API Health Check
router.get('/health', (req, res) => {
  const { isMongoConnected } = require('../config/mongoose');
  res.json({
    success: true,
    status: 'healthy',
    database: isMongoConnected() ? 'mongodb' : 'json_file',
    mongoConnected: isMongoConnected(),
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// REST Chat Endpoint (Fallback for Vercel - no Socket.IO needed)
router.post('/chat', (req, res) => {
  try {
    const { analyzeBotResponse } = require('../services/chatbotService');
    const { message, sessionId } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'message required' });
    }
    const reply = analyzeBotResponse(message, { sessionId });
    res.json({
      success: true,
      reply: {
        sender: 'bot',
        text: reply.text,
        quickReplies: reply.quickReplies || [],
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Chat service error.' });
  }
});

// REST Chat Greeting Endpoint
router.get('/chat/greeting', (req, res) => {
  res.json({
    success: true,
    reply: {
      sender: 'bot',
      text: "Assalam-o-Alaikum! 🌟 Welcome to ProService Support! Mai aapki kis tarah madad kar sakta hoon?\n\nHumari core services:\n1️⃣ 📹 Camera Installation (CCTV)\n2️⃣ 💻 Computer & Laptop Repair\n3️⃣ ⚡ Electricity Problem (Bijli ka Masla)\n4️⃣ 🖨️ Printer Problem & Toner\n\nAap niche button se select kar sakte hain ya apna masla likh kar bata sakte hain.",
      quickReplies: ['📹 Camera Installation', '💻 Computer Repair', '⚡ Electricity Problem', '🖨️ Printer Problem', '🎫 Track My Ticket', '👨‍💼 Talk to Agent'],
      timestamp: new Date().toISOString()
    }
  });
});

// Mount Resource Routes
router.use('/auth', authRoutes);
router.use('/tickets', ticketRoutes);
router.use('/technicians', technicianRoutes);
router.use('/services', serviceRoutes);
router.use('/reviews', reviewRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/admin', adminRoutes);
router.use('/staff', staffRoutes);

module.exports = router;
