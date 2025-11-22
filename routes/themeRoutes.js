// routes/themeRoutes.js
const express = require('express');
const { generateTheme } = require('../services/themeGenerator');

const router = express.Router();

// POST /api/generate-theme
router.post('/generate-theme', async (req, res) => {
  try {
    const { prompt, attempt = 0, themeType = 'image' } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const result = await generateTheme({ prompt, attempt, themeType });

    // Handle retry responses
    if (result.retry) {
      return res.status(202).json(result);
    }

    // Handle error responses
    if (result.error) {
      const statusCode = result.maxAttemptsReached ? 400 : 500;
      return res.status(statusCode).json(result);
    }

    // Success response
    return res.json(result);

  } catch (error) {
    console.error('Error in /api/generate-theme route:', error);
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

    const errorMessage = error.message || 'Unknown error';
    const statusCode = error.message?.includes('Prompt is required') ? 400 : 500;

    res.status(statusCode).json({
      error: 'Failed to generate theme',
      details: errorMessage,
      step: error.step || 'unknown'
    });
  }
});

module.exports = router;
