const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  urduTitle: {
    type: String
  },
  icon: {
    type: String
  },
  badge: {
    type: String
  },
  shortDesc: {
    type: String
  },
  features: {
    type: [String],
    default: []
  },
  startingPrice: {
    type: String
  },
  basePriceNum: {
    type: Number
  },
  turnaround: {
    type: String
  },
  emergencyAvailable: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.models.Service || mongoose.model('Service', serviceSchema);
