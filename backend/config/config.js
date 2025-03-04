// backend/config/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/safewalk',
  JWT_SECRET: process.env.JWT_SECRET || 'safewalk_secret_key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  NODE_ENV: process.env.NODE_ENV || 'development'
};