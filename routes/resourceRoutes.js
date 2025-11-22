// routes/resourceRoutes.js
const express = require('express');
const { getAvailableFonts } = require('../services/fontService');
const { borderRadiusPresets, boxShadowPresets } = require('../config/presets');

const router = express.Router();

// GET /api/fonts
router.get('/fonts', (req, res) => {
  res.json(getAvailableFonts());
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
