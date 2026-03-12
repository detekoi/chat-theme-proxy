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

// Declare variables that will be populated by the dynamic import
let GoogleGenAI, Modality;

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

    // Allow local development (localhost/127.0.0.1 on any port, http or https)
    if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') ||
      origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) {
      return callback(null, true);
    }

    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Only log development mode message
if (isDevelopment) {
  console.log('Running in development mode with test interface enabled');
}

// Initialize fonts on startup
fetchGoogleFonts();

// Mount routes
app.use('/api', themeRoutes);
app.use('/api', resourceRoutes);
app.use('/api', testRoutes);
app.use('/', testRoutes); // Health check at root level

// Handle root endpoint - serve test page in dev, health check in production
app.get('/', (req, res) => {
  if (isDevelopment) {
    // In development, serve the test page
    res.sendFile(path.join(__dirname, 'public', 'themer-tester.html'));
  } else {
    // In production, just return a simple message
    res.status(200).send('Theme Generator API is running. Use /api/generate-theme endpoint for theme generation.');
  }
});

// Main function to initialize GenAI and start the server
async function main() {
  try {
    const genAIModule = await import('@google/genai');
    GoogleGenAI = genAIModule.GoogleGenAI;
    Modality = genAIModule.Modality;
    console.log('@google/genai SDK loaded successfully.');

    // Start the server only after the SDK is loaded
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
    console.error("Failed to load @google/genai SDK or start server:", err);
    process.exit(1);
  }
}

main();
