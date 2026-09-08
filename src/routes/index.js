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
