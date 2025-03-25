// backend/config/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/safewalk',
  JWT_SECRET: process.env.JWT_SECRET || 'safewalk_secret_key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Configuration par défaut pour le calcul des itinéraires
  SAFETY_CONFIG: {
    DANGER_RADIUS: {
      'poor_lighting': 5,        // en mètres
      'unsafe_area': 50,
      'construction': 5,
      'obstacle': 10,
      'bad_weather': 100
    },
    AVOIDANCE_FACTOR: {
      'poor_lighting': 1.2,
      'unsafe_area': 2.0,
      'construction': 1.8,
      'obstacle': 2.0,
      'bad_weather': 1.0
    },
    // Durée de validité des signalements en jours
    REPORT_VALIDITY_DAYS: 30
  }
};