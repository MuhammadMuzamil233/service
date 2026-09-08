const mongoose = require('mongoose');

const technicianSchema = new mongoose.Schema({
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
  phone: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  specialty: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  specialtyLabel: {
    type: String
  },
  rating: {
    type: Number,
    default: 5.0
  },
  jobsCompleted: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['available', 'busy', 'on-leave', 'offline'],
    default: 'available',
    index: true
  },
  address: {
    type: String,
    default: 'Pakistan'
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

module.exports = mongoose.models.Technician || mongoose.model('Technician', technicianSchema);
