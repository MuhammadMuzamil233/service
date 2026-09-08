require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

// Config & Database
const { readDb } = require('./src/config/db');
const { connectMongo, isMongoConnected } = require('./src/config/mongoose');

// Middlewares
const requestLogger = require('./src/middlewares/logger');
const { errorHandler } = require('./src/middlewares/errorHandler');

// Services & Routes
const { setupSocketIO } = require('./src/services/socketService');
const apiRoutes = require('./src/routes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize Database & Seeds
readDb();
connectMongo();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Initialize WebSockets
setupSocketIO(io);

// Mount API Routes
app.use('/api', apiRoutes);

// Frontend Page Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/staff', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'staff.html'));
});

// Fallback to customer portal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central Error Handler
app.use(errorHandler);

// Start Server
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 ProService Customer Services Platform`);
  console.log(`⚙️  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`👉 Customer Portal: http://localhost:${PORT}`);
  console.log(`👉 Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`👉 API Health:     http://localhost:${PORT}/api/health`);
  console.log(`👉 Database:       ${isMongoConnected() ? '🍃 MongoDB Atlas (Connected)' : '📁 Local JSON DB (data/db.json)'}`);
  console.log(`===================================================`);
});

module.exports = { app, server };
