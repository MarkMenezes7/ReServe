require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'reserve-secret-key-change-in-production',
  TOKEN_EXPIRY: '7d',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://localhost:5001',
  DB_PATH: process.env.DB_PATH || './reserve.db',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
