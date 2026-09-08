const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    trim: true,
    index: true
  },
  role: {
    type: String,
    enum: ['admin', 'technician', 'customer'],
    default: 'customer'
  },
  technicianId: {
    type: String,
    default: null
  },
  specialty: {
    type: String,
    default: null
  },
  emailVerified: {
    type: Boolean,
    default: false
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

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
