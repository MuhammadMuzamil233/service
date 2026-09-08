const mongoose = require('mongoose');

const timelineItemSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  note: { type: String, default: '' }
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customerId: {
    type: String,
    default: null,
    index: true
  },
  customerEmail: {
    type: String,
    default: null,
    index: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  serviceType: {
    type: String,
    required: true,
    index: true
  },
  serviceName: {
    type: String
  },
  address: {
    type: String,
    required: true
  },
  problemDescription: {
    type: String,
    default: ''
  },
  urgency: {
    type: String,
    enum: ['Standard', 'Emergency', 'Scheduled'],
    default: 'Standard'
  },
  status: {
    type: String,
    enum: ['Pending', 'Assigned', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending',
    index: true
  },
  assignedTo: {
    type: String,
    default: null
  },
  assignedTechId: {
    type: String,
    default: null,
    index: true
  },
  estimatedCost: {
    type: Number,
    default: 2500
  },
  partsReplaced: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  timeline: {
    type: [timelineItemSchema],
    default: []
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
