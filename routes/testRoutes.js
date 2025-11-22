// routes/testRoutes.js
const express = require('express');
const { GEMINI_API_KEY } = require('../config/constants');
const { getAvailableFonts } = require('../services/fontService');
const { borderRadiusPresets, boxShadowPresets } = require('../config/presets');

const router = express.Router();

// GET /api/debug
router.get('/debug', (req, res) => {
  res.json({
    status: 'running',
    geminiApiKeyConfigured: !!GEMINI_API_KEY,
    apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    fontCount: getAvailableFonts().length,
    borderRadiusPresets: Object.keys(borderRadiusPresets),
    boxShadowPresets: Object.keys(boxShadowPresets),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage(),
    serverUptime: process.uptime()
  });
});

// GET /api/test-gemini
router.get('/test-gemini', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Test Step 1: gemini-2.5-flash-lite with structured output
    const step1Response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Create a simple test theme with a red circle image prompt" }]
        }],
        generationConfig: {
          responseSchema: {
            type: "object",
            properties: {
              test_field: { type: "string" }
            },
            required: ["test_field"]
          },
          responseMimeType: "application/json"
        }
      })
    });

    if (!step1Response.ok) {
      const errorData = await step1Response.text();
      return res.status(500).json({
        error: 'Step 1 (structured output) test failed',
        details: errorData,
        status: step1Response.status,
        apiKeyConfigured: !!GEMINI_API_KEY
      });
    }

    const step1Data = await step1Response.json();
    const step1HasText = step1Data.candidates?.[0]?.content?.parts?.some(p => p.text);

    res.json({
      success: true,
      apiKeyConfigured: true,
      approach: 'Two-step generation',
      step1: {
        model: 'gemini-2.5-flash-lite',
        hasText: step1HasText,
        structuredOutput: true
      },
      step2: {
        model: 'gemini-2.5-flash-image',
        description: 'Used for image generation based on Step 1 prompt'
      },
      apiMethod: 'REST'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Gemini API test failed',
      details: error.message,
      apiKeyConfigured: !!GEMINI_API_KEY,
      apiMethod: 'REST'
    });
  }
});

// GET /api/test-image-model
router.get('/test-image-model', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Define a simple test schema with image_prompt
    const testSchema = {
      type: "object",
      properties: {
        shape: { type: "string", description: "The shape that was created" },
        color: { type: "string", description: "The color of the shape" },
        image_prompt: { type: "string", description: "A prompt to generate the image" }
      },
      required: ["shape", "color", "image_prompt"]
    };

    // STEP 1: Test gemini-2.5-flash-lite with structured output
    console.log('Testing Step 1: gemini-2.5-flash-lite with structured output');
    const step1Response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Create a blue square. Provide JSON with shape, color, and an image_prompt for generating the image." }]
        }],
        generationConfig: {
          responseSchema: testSchema,
          responseMimeType: "application/json"
        }
      })
    });

    if (!step1Response.ok) {
      const errorData = await step1Response.text();
      return res.status(500).json({
        error: 'Step 1 (structured output) test failed',
        details: errorData,
        status: step1Response.status,
        apiKeyConfigured: !!GEMINI_API_KEY,
        step: 1
      });
    }

    const step1Data = await step1Response.json();
    const step1HasText = step1Data.candidates?.[0]?.content?.parts?.some(p => p.text);

    let parsedJson = null;
    let imagePrompt = null;
    if (step1HasText) {
      const textPart = step1Data.candidates[0].content.parts.find(p => p.text);
      try {
        parsedJson = JSON.parse(textPart.text);
        imagePrompt = parsedJson.image_prompt;
      } catch (e) {
        console.error('JSON parse error in test:', e);
      }
    }

    // STEP 2: Test gemini-2.5-flash-image with the image prompt
    let step2Success = false;
    let step2HasImage = false;

    if (imagePrompt) {
      console.log(`Testing Step 2: gemini-2.5-flash-image with prompt: "${imagePrompt}"`);
      try {
        const step2Response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: imagePrompt }]
            }],
            generationConfig: {
              temperature: 0.8,
              topK: 40,
              topP: 0.95
            }
          })
        });

        if (step2Response.ok) {
          const step2Data = await step2Response.json();
          step2HasImage = step2Data.candidates?.[0]?.content?.parts?.some(p => p.inlineData);
          step2Success = true;
        }
      } catch (e) {
        console.error('Step 2 test error:', e);
      }
    }

    res.json({
      success: true,
      approach: 'Two-step generation',
      step1: {
        model: 'gemini-2.5-flash-lite',
        structuredOutputWorking: !!parsedJson,
        hasText: step1HasText,
        parsedJson: parsedJson
      },
      step2: {
        model: 'gemini-2.5-flash-image',
        success: step2Success,
        hasImage: step2HasImage,
        imagePromptUsed: imagePrompt?.substring(0, 100) || null
      },
      apiMethod: 'REST'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Two-step generation test failed',
      details: error.message,
      apiKeyConfigured: !!GEMINI_API_KEY,
      apiMethod: 'REST'
    });
  }
});

// GET /api/test-theme
router.get('/test-theme', (req, res) => {
  // Simple test theme for debugging
  const testTheme = {
    themeData: {
      theme_name: "Debug Test Theme",
      background_color: "rgba(24, 24, 36, 0.9)",
      border_color: "#5e43bd",
      text_color: "#eef1ff",
      username_color: "#a98eff",
      font_family: "System UI",
      border_radius: "Rounded",
      border_radius_value: "16px",
      box_shadow: "Simple 3D",
      box_shadow_value: "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px",
      description: "A test theme for debugging purposes."
    },
    backgroundImage: null // No image in test mode
  };

  // Add artificial delay to simulate API call
  setTimeout(() => {
    res.json(testTheme);
  }, 500);
});

// GET /health
router.get('/health', (req, res) => {
  res.status(200).send('Theme Generator API is running');
});

module.exports = router;
