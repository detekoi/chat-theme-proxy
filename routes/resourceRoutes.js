// routes/resourceRoutes.js
const express = require('express');
const { getAvailableFonts, searchGoogleFonts } = require('../services/fontService');
const { borderRadiusPresets, boxShadowPresets } = require('../config/presets');

const router = express.Router();

// GET /api/fonts
router.get('/fonts', (req, res) => {
  res.json(getAvailableFonts());
});

// GET /api/fonts/search?q=<query>
router.get('/fonts/search', (req, res) => {
  const query = req.query.q;
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query parameter "q" must be at least 2 characters.' });
  }
  const results = searchGoogleFonts(query.trim());
  res.json(results);
});

// GET /api/border-radius-presets
router.get('/border-radius-presets', (req, res) => {
  res.json(borderRadiusPresets);
});

// GET /api/box-shadow-presets
router.get('/box-shadow-presets', (req, res) => {
  res.json(boxShadowPresets);
});

module.exports = router;
