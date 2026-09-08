const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() },
  agentName: { type: String, default: null }
}, { _id: false });

const chatSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customerName: {
    type: String,
    default: 'Customer'
  },
  phone: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['bot', 'live', 'closed'],
    default: 'bot',
    index: true
  },
  unreadCount: {
    type: Number,
    default: 0
  },
  lastMessage: {
    type: String,
    default: ''
  },
  messages: {
    type: [chatMessageSchema],
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

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);
