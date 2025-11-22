// config/constants.js
require('dotenv').config();

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Get port from environment variable
const PORT = process.env.PORT || 8091;

// Get API keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RUNWARE_API_KEY = process.env.RUNWARE_API_KEY;
const GOOGLE_FONTS_API_KEY = process.env.WEB_FONTS_API_KEY || process.env.WEP_FONTS_API_KEY;

// Enable verbose logging
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

// Max retry attempts for theme generation
const MAX_RETRY_ATTEMPTS = 3;

module.exports = {
  isDevelopment,
  PORT,
  GEMINI_API_KEY,
  RUNWARE_API_KEY,
  GOOGLE_FONTS_API_KEY,
  VERBOSE_LOGGING,
  MAX_RETRY_ATTEMPTS
};
