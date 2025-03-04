// backend/models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  category: {
    type: String,
    enum: ['poor_lighting', 'unsafe_area', 'construction', 'obstacle', 'bad_weather'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  severity: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  temporary: {
    type: Boolean,
    default: false
  },
  expiresAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index géospatial pour les requêtes de proximité
reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);