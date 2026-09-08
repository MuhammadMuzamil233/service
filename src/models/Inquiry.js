const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  service: {
    type: String
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'New'
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.models.Inquiry || mongoose.model('Inquiry', inquirySchema);
