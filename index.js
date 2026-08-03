// index.js
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { PORT, isDevelopment } = require('./config/constants');
const { fetchGoogleFonts } = require('./services/fontService');
const themeRoutes = require('./routes/themeRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

// Trust Cloud Run's load balancer (1 proxy hop) so express-rate-limit
// can correctly read client IPs from X-Forwarded-For headers
app.set('trust proxy', 1);

// Configure CORS
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or file://)
    if (!origin || origin === 'null') return callback(null, true);

    // Allow trusted domains
    if (origin === 'https://detekoi.github.io') return callback(null, true);
    if (origin === 'https://wildcat.chat') return callback(null, true);
    if (origin === 'https://www.wildcat.chat') return callback(null, true);

    // Allow Firebase preview domains (e.g. wildcat-chat--*.web.app or wildcat-*.web.app)
    if (/^https:\/\/wildcat-[a-z0-9-]+\.web\.app$/i.test(origin) || /^https:\/\/wildcat-[a-z0-9-]+\.firebaseapp\.com$/i.test(origin)) {
      return callback(null, true);
    }

    // Allow local development (localhost/127.0.0.1 on any port, http or https)
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') ||
      origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // limit each IP to 600 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for OPTIONS preflight and static read-only resource endpoints
    if (req.method === 'OPTIONS') return true;
    if (req.path === '/api/fonts' || req.path.startsWith('/api/fonts/')) return true;
    if (req.path === '/api/border-radius-presets' || req.path === '/api/box-shadow-presets') return true;
    return false;
  }
});
app.use(limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Only log development mode message
if (isDevelopment) {
  console.log('Running in development mode with test interface enabled');
}

// Fonts are initialized in main() before the server starts listening

// Mount routes
const sceneConfigRoutes = require('./routes/sceneConfigRoutes');
const themeLibraryRoutes = require('./routes/themeLibraryRoutes');
app.use('/api', themeRoutes);
app.use('/api', resourceRoutes);
app.use('/api', sceneConfigRoutes);
app.use('/api', themeLibraryRoutes);
app.use('/api', testRoutes);
app.use('/', testRoutes); // Health check at root level

// Handle root endpoint - return health check message
app.get('/', (req, res) => {
  res.status(200).send('Theme Generator API is running. Use /api/generate-theme endpoint for theme generation.');
});

// Main function to initialize fonts and start the server
async function main() {
  try {
    // Initialize fonts before accepting requests
    await fetchGoogleFonts();

    // Start the server only after fonts are loaded
    const { GEMINI_API_KEY, RUNWARE_API_KEY } = require('./config/constants');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Gemini API Key Loaded: ${!!GEMINI_API_KEY}`);
      console.log(`Runware API Key Loaded: ${!!RUNWARE_API_KEY}`);
      if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set. The application will not be able to call the Gemini API.");
      }
      if (!RUNWARE_API_KEY) {
        console.error("RUNWARE_API_KEY is not set. Image generation will not be available.");
      }
    });

  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();
