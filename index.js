// index.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const path = require('path');


// Declare variables that will be populated by the dynamic import
let GoogleGenAI, Modality;

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files 
app.use(express.static(path.join(__dirname, 'public')));

// Only log development mode message
if (isDevelopment) {
  console.log('Running in development mode with test interface enabled');
}

// Get port from environment variable
const PORT = process.env.PORT || 8091;

// Get API key from environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Enable verbose logging
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true' || true;

// Define border radius presets
const borderRadiusPresets = {
  "None": "0px",
  "Subtle": "8px",
  "Rounded": "16px",
  "Pill": "24px"
};

// Define box shadow presets
const boxShadowPresets = {
  "None": "none",
  "Soft": "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "Simple 3D": "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px",
  "Intense 3D": "rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px",
  "Sharp": "8px 8px 0px 0px rgba(0, 0, 0, 0.9)"
};

// Helper functions to get CSS values from preset names
const getBorderRadiusValue = (preset) => borderRadiusPresets[preset] || borderRadiusPresets["None"];
const getBoxShadowValue = (preset) => boxShadowPresets[preset] || boxShadowPresets["None"];

// Define available fonts
const availableFonts = [
    // Custom fonts
    { name: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', sans-serif", description: 'Designed for high legibility and reading clarity, especially at small sizes.', custom: true },
    { name: 'Tektur', value: "'Tektur', sans-serif", description: 'Modern and slightly angular typeface with a technical/sci-fi aesthetic.', custom: true },
    { name: 'MedievalSharp', value: "'MedievalSharp', cursive", description: 'Evokes a medieval/fantasy atmosphere with calligraphic details.', custom: true },
    { name: 'Press Start 2P', value: "'Press Start 2P', cursive", description: 'Pixelated retro gaming font that resembles 8-bit text.', custom: true },
    { name: 'Jacquard', value: "'Jacquard', monospace", description: 'Pixelated font with retro fantasy vibes based on Victorian needlepoint.', custom: true },
    
    // System fonts organized by categories
    // Sans-serif fonts
    { name: 'System UI', value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
    { name: 'Arial', value: "Arial, sans-serif", description: 'Classic sans-serif font with good readability.' },
    { name: 'Helvetica', value: "Helvetica, Arial, sans-serif", description: 'Clean modern sans-serif font widely used in design.' },
    { name: 'Verdana', value: "Verdana, Geneva, sans-serif", description: 'Sans-serif designed for good readability on screens.' },
    { name: 'Tahoma', value: "Tahoma, Geneva, sans-serif", description: 'Compact sans-serif with good readability at small sizes.' },
    { name: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif", description: 'Humanist sans-serif with distinctive character shapes.' },
    { name: 'Calibri', value: "Calibri, sans-serif", description: 'Modern sans-serif with rounded details and good readability.' },
    
    // Serif fonts
    { name: 'Times New Roman', value: "'Times New Roman', Times, serif", description: 'Classic serif font with traditional letterforms.' },
    { name: 'Georgia', value: "Georgia, serif", description: 'Elegant serif font designed for screen readability.' },
    { name: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", description: 'Elegant serif based on Renaissance letterforms.' },
    { name: 'EB Garamond', value: "'EB Garamond', Garamond, Baskerville, 'Baskerville Old Face', serif", description: 'Classical serif with elegant proportions.', custom: true },
    
    // Monospace fonts
    { name: 'Courier New', value: "'Courier New', Courier, monospace", description: 'Classic monospaced font resembling typewriter text.' },
    { name: 'Consolas', value: "'Consolas', monaco, monospace", description: 'Modern monospaced font designed for coding.' },
    { name: 'Lucida Console', value: "'Lucida Console', Monaco, monospace", description: 'Clear monospace font with good readability.' },
    
    // Display/Decorative fonts that are commonly available
    { name: 'Impact', value: "'Impact', Haettenschweiler, sans-serif", description: 'Bold condensed sans-serif font, often used for headlines.' },
    { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive", description: 'Casual script-like font with a friendly appearance.' },
    { name: 'Arial Black', value: "'Arial Black', Gadget, sans-serif", description: 'Extra bold version of Arial for strong emphasis.' }
];

// Add helper to generate a unique storage key for generated themes
const generateThemeStorageKey = (themeId) => `generated-theme-image-${themeId}`;

// Define theme generation endpoint
app.post('/api/generate-theme', async (req, res) => {
  // Ensure GoogleGenAI and Modality are loaded
  if (!GoogleGenAI || !Modality) {
    console.error("GenAI SDK not initialized yet for /api/generate-theme call");
    return res.status(503).json({ error: 'Service temporarily unavailable, SDK loading.' });
  }

  try {
    const { prompt, attempt = 0, forceJson = false, previousThemeData, themeType = 'image' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    console.log(`🎨 Theme Request: "${prompt}" | ${themeType === 'image' ? 'With Image' : 'Color Only'} | Attempt ${attempt + 1}/3`);
    
    // Generate list of available font names for the prompt
    const fontOptions = availableFonts.map(font => `'${font.name}'`).join(', ');
    
    // Adjust parameters based on attempt number to improve retry chances
    let temperature = 0.5;
    let topK = 20;
    let topP = 0.9;
    let prompt_prefix = '';
    // Generate a random seed based on timestamp and attempt number to prevent RECITATION
    const randomSeed = Math.floor(Date.now() % 1000000) + (attempt * 10000);
    
    // If we're retrying, adjust the params to avoid RECITATION or to encourage image generation
    if (attempt > 0) {
      // Use a strategy to avoid RECITATION errors with varied parameters on each attempt
      if (attempt === 1) {
        // First retry - use high temperature
        temperature = 1.1; // Experimental: temperature above 1
        topK = 32;
        topP = 0.92;
        prompt_prefix = themeType === 'image' ? 
          'Design a Twitch theme with both a small background pattern image AND a JSON object. ' : 
          'Design a Twitch theme with a solid background color (no image) AND a JSON object. ';
      } else if (attempt === 2) {
        // Second retry - completely different approach with lower temperature
        temperature = 0.4;
        topK = 40;
        topP = 0.85;
        prompt_prefix = themeType === 'image' ? 
          'Create a small pattern image and also a JSON theme. For the theme use this exact format: ' : 
          'Create a JSON theme with a solid color background (no image). For the theme use this exact format: ';
      } else {
        // For higher attempts (3+), focus on getting valid JSON with different parameters
        temperature = 0.3;
        topK = 20;
        topP = 0.8;
        prompt_prefix = 'RESPOND WITH ONLY A JSON OBJECT in this exact format: ';
      }
      
      console.log(`Retry attempt ${attempt}: Using temperature=${temperature}, topK=${topK}, topP=${topP}`);
    }
    
    // Define schema with image_prompt field for two-step generation
    const themeSchemaWithPrompt = {
      type: "object",
      properties: {
        theme_name: {
          type: "string",
          description: "A creative theme name inspired by the prompt"
        },
        background_color: {
          type: "string",
          description: "RGBA color with opacity (e.g., rgba(12, 20, 69, 0.85))"
        },
        border_color: {
          type: "string",
          description: "Hex color for borders (e.g., #ff6bcb)"
        },
        text_color: {
          type: "string",
          description: "Hex color for chat text (e.g., #efeff1)"
        },
        username_color: {
          type: "string",
          description: "Hex color for usernames (e.g., #9147ff)"
        },
        font_family: {
          type: "string",
          description: "Font family name from the available fonts list",
          enum: availableFonts.map(f => f.name)
        },
        border_radius: {
          type: "string",
          description: "Border radius preset",
          enum: ["None", "Subtle", "Rounded", "Pill"]
        },
        box_shadow: {
          type: "string",
          description: "Box shadow preset",
          enum: ["None", "Soft", "Simple 3D", "Intense 3D", "Sharp"]
        },
        description: {
          type: "string",
          description: "Brief description capturing the essence of the theme"
        },
        image_prompt: {
          type: "string",
          description: "A detailed prompt for generating a subtle, seamless, tileable background pattern image that matches the theme's mood and colors"
        }
      },
      required: ["theme_name", "background_color", "border_color", "text_color", "username_color", "font_family", "border_radius", "box_shadow", "description", "image_prompt"]
    };
    
    // Construct the main prompt text for theme generation
    let mainPromptText = `Create a visually appealing Twitch chat theme for: "${prompt}".

Consider the feeling and style of "${prompt}" and provide:
1. Complete theme settings (colors, fonts, styles)
2. A detailed image prompt for generating a background pattern

Theme guidelines:
- Choose colors that capture the essence of "${prompt}"
- Select an appropriate font from: ${fontOptions}
- Pick border radius: None (sharp/pixelated), Subtle (slightly rounded), Rounded (moderately rounded), or Pill (very rounded)
- Pick box shadow: None (flat), Soft (subtle), Simple 3D (light depth), Intense 3D (strong depth), or Sharp (pixel-art)

${themeType === 'image' ? `
Image prompt guidelines:
- Describe a **subtle and seamless background pattern** that complements the theme's mood and colors
- The pattern should tile seamlessly without visible borders or edges
- Use low contrast to ensure text readability
- Keep the design simple with minimal elements
- Use 2-3 colors that harmonize with the theme
- Focus on textures or repeating patterns that evoke the feeling of "${prompt}"
- DO NOT include literal text or words in the pattern
- Ensure it's borderless and edge-free for perfect tiling

Example: For "cyberpunk" → "A subtle seamless tileable pattern of dark blue circuit board lines with occasional pink neon accents, low contrast, minimal design, no text"
` : `
Image prompt should be empty or describe a simple solid color (no pattern needed for color-only themes).
`}

Quick font guide:
- Modern/tech: Tektur, Consolas, System UI
- Fantasy/medieval: MedievalSharp, Jacquard, EB Garamond
- Gaming/retro: Press Start 2P, Jacquard, Impact
- Readable: Atkinson Hyperlegible, Verdana
- Classic: EB Garamond, Georgia, Times New Roman`;

    const sdkContents = [
      {
        role: "user",
        parts: [ { text: mainPromptText } ]
      }
    ];

    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // STEP 1: Use gemini-2.5-flash-lite with structured output to get theme JSON + image prompt
    let themeResponse;
    try {
      console.log('📝 Step 1: Generating theme data (gemini-2.5-flash-lite)...');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Client': 'genai-js/1.0.0'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: mainPromptText }]
          }],
          generationConfig: {
            temperature: temperature,
            topK: topK,
            topP: topP,
            responseSchema: themeSchemaWithPrompt,
            responseMimeType: "application/json"
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Step 1 REST API Error:', response.status, errorData);
        throw new Error(`Step 1 REST API Error: ${response.status} - ${errorData}`);
      }
      
      themeResponse = await response.json();

      // Parse and log the theme name
      const themeText = themeResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (themeText) {
        try {
          const parsedTheme = JSON.parse(themeText);
          console.log(`✓ Step 1 Complete: "${parsedTheme.theme_name}" (${parsedTheme.font_family}, ${parsedTheme.border_radius}, ${parsedTheme.box_shadow})`);
        } catch (e) {
          console.log('✓ Step 1 Complete');
        }
      }
    } catch (apiError) {
      console.error('Error calling Step 1 (theme generation) API:', apiError);
      const errorMessage = apiError.message || apiError.toString();
      let errorDetails = 'No additional details';
      if (typeof apiError === 'object' && apiError !== null) {
        if (apiError.cause) errorDetails = JSON.stringify(apiError.cause);
        else if (apiError.response && apiError.response.data) errorDetails = JSON.stringify(apiError.response.data);
        else errorDetails = JSON.stringify(apiError);
      }
      console.error('Step 1 API Error details:', errorDetails);
      return res.status(500).json({
        error: 'Failed to generate theme data',
        details: errorMessage,
        apiErrorDetails: errorDetails,
        step: 'theme_generation'
      });
    }
    
    // STEP 2: Use gemini-2.5-flash-image to generate the background image (if needed)
    let imageResponse = null;
    let apiResponse = themeResponse; // For backwards compatibility with existing parsing code
    
    if (themeType === 'image') {
      try {
        // Extract the theme data from Step 1
        const themeText = themeResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!themeText) {
          throw new Error('No theme data found in Step 1 response');
        }
        
        const themeDataFromStep1 = JSON.parse(themeText);
        const imagePrompt = themeDataFromStep1.image_prompt;

        if (imagePrompt && imagePrompt.trim().length > 0) {
          console.log(`🖼️  Step 2: Generating background image (gemini-2.5-flash-image)...`);

          const imageGenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Client': 'genai-js/1.0.0'
            },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: imagePrompt }]
              }],
              generationConfig: {
                temperature: 0.8,  // Slightly creative for image generation
                topK: 40,
                topP: 0.95
              }
            })
          });
          
          if (!imageGenResponse.ok) {
            const errorData = await imageGenResponse.text();
            console.log(`✗ Step 2 Failed (${imageGenResponse.status}) - Continuing with color-only theme`);
          } else {
            imageResponse = await imageGenResponse.json();

            // Merge the image parts into the theme response
            const imageParts = imageResponse.candidates?.[0]?.content?.parts || [];
            const imagePart = imageParts.find(p => p.inlineData?.mimeType?.startsWith('image/'));

            if (imagePart) {
              // Add the image to the theme response
              if (!apiResponse.candidates[0].content.parts) {
                apiResponse.candidates[0].content.parts = [];
              }
              apiResponse.candidates[0].content.parts.push(imagePart);
              const imageSize = Math.round(imagePart.inlineData.data.length / 1024);
              console.log(`✓ Step 2 Complete: Background image generated (${imageSize}KB)`);
            } else {
              console.log('✗ Step 2: No image in response');
            }
          }
        } else {
          console.log('→ Step 2: Skipped (no image prompt)');
        }
      } catch (imageError) {
        console.log(`✗ Step 2 Error: ${imageError.message} - Continuing with color-only theme`);
      }
    } else {
      console.log('→ Step 2: Skipped (color-only theme)');
    }

    // Check response format (condensed logging)
    const hasContent = apiResponse.candidates?.[0]?.content != null;
    const hasText = hasContent && apiResponse.candidates[0].content.parts?.some(p => p.text);
    const hasImage = hasContent && apiResponse.candidates[0].content.parts?.some(p => p.inlineData?.mimeType?.startsWith('image/'));
    const finishReason = apiResponse.candidates?.[0]?.finishReason || 'unknown';
    
    // Extract the theme data and image from the response
    try {
      // Initialize variables
      let themeData = null;
      let backgroundImage = null;
      
      // Handle RECITATION finish reason specially
      if (apiResponse.candidates && 
          apiResponse.candidates.length > 0 && 
          apiResponse.candidates[0].finishReason === 'RECITATION') {
        console.log('Received RECITATION finish reason. Retrying with different parameters...');
        
        if (attempt < 3) {  // Reduced from 5 to 3 since structured output makes retries less likely
          const nextAttempt = attempt + 1;
          console.log(`RECITATION error - retrying attempt ${nextAttempt}`);
          
          return res.status(202).json({
            retry: true,
            message: 'Adjusting parameters to avoid RECITATION error...',
            attempt: nextAttempt
          });
        } else {
          return res.status(400).json({
            error: 'Model returned RECITATION error repeatedly',
            maxAttemptsReached: true
          });
        }
      }
      
      // Process each part of the response - SIMPLIFIED with structured output
      if (apiResponse.candidates && apiResponse.candidates.length > 0) {
        const parts = apiResponse.candidates[0]?.content?.parts || [];
        
        for (const part of parts) {
          // With structured output, text part will be valid JSON
          if (part.text) {
            try {
              // Structured output guarantees valid JSON matching our schema
              themeData = JSON.parse(part.text);
            } catch (e) {
              console.error('✗ JSON parsing error:', e.message);
              // Continue to try other parts
            }
          }
          // Extract image data if present
          else if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
            backgroundImage = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data // This is base64 encoded image data
            };
          }
        }
      }
      if (themeData) {
        // Structured output guarantees valid JSON, so validation is simpler
        // Note: enum constraints in schema already ensure valid font_family, border_radius, and box_shadow
        
        // Check if we have a background image when themeType is 'image' and this isn't a high-attempt retry
        if (themeType === 'image' && !backgroundImage && attempt < 3) {  // Reduced from 5 to 3
          console.log(`No background image was generated. Retrying... (attempt ${attempt + 1})`);
          
          // Add CSS values to theme data for consistent experience between attempts
          themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
          themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);
          
          return res.status(202).json({
            retry: true,
            message: `No background image was generated. Retrying (attempt ${attempt + 1}/3)...`,
            attempt: attempt + 1,
            themeData: themeData,
            includesThemeData: true
          });
        } else if (themeType === 'image' && !backgroundImage) {
          console.log('No background image was generated after retries. Proceeding with theme data only.');
        } else if (themeType === 'color' && backgroundImage) {
          console.log('Background image was generated even though themeType is color. Ignoring the image.');
          backgroundImage = null;
        }
        
        // Convert preset names to actual CSS values
        themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
        themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);

        // Final summary
        console.log(`✅ Theme Complete: "${themeData.theme_name}" ${backgroundImage ? '+ Background Image' : '(Color Only)'}`);

        const maxAttemptsReached = attempt >= 3 && !backgroundImage;  // Updated to match new max attempts
        
        return res.json({
          themeData: themeData,
          backgroundImage: backgroundImage,
          maxAttemptsReached: maxAttemptsReached,
          noImageAvailable: maxAttemptsReached
        });
      }
      
      // If we can't extract valid JSON (unlikely with structured output), retry
      if (attempt < 3) {  // Reduced from 5 to 3
        console.log(`No valid theme data found. Retrying... (attempt ${attempt + 1})`);
        return res.status(202).json({
          retry: true,
          message: `No valid theme data received. Retrying (attempt ${attempt + 1}/3)...`,
          attempt: attempt + 1
        });
      }
      
      // If we've already retried the max number of times, return an error
      return res.status(400).json({ 
        error: 'Could not parse theme data from Gemini response',
        responseData: {
          finishReason: finishReason,
          hasContent: hasContent,
          hasText: hasText,
          hasImage: hasImage
        },
        maxAttemptsReached: true
      });
    } catch (jsonError) {
      console.error('Error parsing theme JSON or extracting image:', jsonError);
      // Return a properly formatted error response
      res.status(400).json({ 
        error: 'Error parsing theme data', 
        details: jsonError.message,
        partialData: apiResponse.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 200) || 'No text data found'
      });
    }
    
  } catch (error) {
    console.error('Error in /api/generate-theme route:', error);
    // The error object from @google/genai might be different from AxiosError
    // Log its structure to adapt your error reporting
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    res.status(500).json({ 
      error: 'Failed to generate theme',
      details: error.message || (error.response?.data?.error?.message || 'Unknown SDK error')
    });
  }
});

// Endpoint to get all available fonts
app.get('/api/fonts', (req, res) => {
  res.json(availableFonts);
});

// Endpoint to get border radius presets
app.get('/api/border-radius-presets', (req, res) => {
  res.json(borderRadiusPresets);
});

// Endpoint to get box shadow presets
app.get('/api/box-shadow-presets', (req, res) => {
  res.json(boxShadowPresets);
});

// Debug endpoint to check server status and configuration
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'running',
    geminiApiKeyConfigured: !!GEMINI_API_KEY,
    apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    fontCount: availableFonts.length,
    borderRadiusPresets: Object.keys(borderRadiusPresets),
    boxShadowPresets: Object.keys(boxShadowPresets),
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage(),
    serverUptime: process.uptime()
  });
});

// Test endpoint to verify Gemini API key and two-step generation
app.get('/api/test-gemini', async (req, res) => {
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

// Test endpoint for two-step generation process
app.get('/api/test-image-model', async (req, res) => {
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

// Test endpoint to provide a sample theme without calling Gemini API
app.get('/api/test-theme', (req, res) => {
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Theme Generator API is running');
});

// Handle root endpoint - serve test page in dev, health check in production
app.get('/', (req, res) => {
  if (isDevelopment) {
    // In development, serve the test page
    res.sendFile(path.join(__dirname, 'public', 'test-gemini-api.html'));
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
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Gemini API Key Loaded: ${!!GEMINI_API_KEY}`);
      if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not set. The application will not be able to call the Gemini API.");
      }
    });

  } catch (err) {
    console.error("Failed to load @google/genai SDK or start server:", err);
    process.exit(1);
  }
}

main();