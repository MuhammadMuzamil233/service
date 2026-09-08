const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ticketId: {
    type: String,
    default: null
  },
  customerName: {
    type: String,
    required: true
  },
  serviceType: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: 5
  },
  comment: {
    type: String,
    default: ''
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);
