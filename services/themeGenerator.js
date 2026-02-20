// services/themeGenerator.js
const { GEMINI_API_KEY, MAX_RETRY_ATTEMPTS } = require('../config/constants');
const { getBorderRadiusValue, getBoxShadowValue } = require('../utils/helpers');
const { getAvailableFonts } = require('./fontService');
const { generateBackgroundImage } = require('./imageGenerator');

/**
 * Build the theme schema for structured output
 * @param {string} themeType - 'image' or 'color'
 * @returns {Object} - JSON schema object
 */
function buildThemeSchema(themeType) {
  const availableFonts = getAvailableFonts();

  const baseRequiredFields = [
    "theme_name",
    "background_color",
    "border_color",
    "text_color",
    "username_color",
    "font_family",
    "border_radius",
    "box_shadow",
    "description"
  ];

  const requiredFields = themeType === 'image'
    ? [...baseRequiredFields, "image_prompt"]
    : baseRequiredFields;

  return {
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
        description: themeType === 'image'
          ? "A detailed prompt for generating a subtle, seamless, tileable background pattern image that matches the theme's mood and colors"
          : "Not needed for color-only themes - can be empty or omitted"
      }
    },
    required: requiredFields
  };
}

/**
 * Build the main prompt text for theme generation
 * @param {string} prompt - User's theme prompt
 * @param {string} themeType - 'image' or 'color'
 * @returns {string} - Formatted prompt text
 */
function buildPromptText(prompt, themeType) {
  return `Create a visually appealing Twitch chat theme for: "${prompt}".

Consider the feeling and style of "${prompt}" and provide:
1. Complete theme settings (colors, fonts, styles)
${themeType === 'image' ? '2. A detailed image prompt for generating a background pattern' : '2. No image prompt needed (color-only theme)'}

Theme guidelines:
- Choose colors that capture the essence of "${prompt}"
- Select an appropriate font from the available options
- Pick an appropriate border radius
- Pick an appropriate box shadow style

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
For color-only themes:
- Focus on creating a cohesive color palette that captures the essence of "${prompt}"
- Use solid background colors or gradients
- No background pattern images will be generated
- The image_prompt field can be empty or omitted
`}
`;
}

/**
 * Get generation config parameters based on attempt number
 * @param {number} attempt - Current attempt number
 * @param {string} themeType - 'image' or 'color'
 * @returns {Object} - Generation config with temperature, topK, topP
 */
function getGenerationConfig(attempt, themeType) {
  let temperature = 0.5;
  let topK = 20;
  let topP = 0.9;

  if (attempt > 0) {
    if (attempt === 1) {
      temperature = 1.1;
      topK = 32;
      topP = 0.92;
    } else if (attempt === 2) {
      temperature = 0.4;
      topK = 40;
      topP = 0.85;
    } else {
      temperature = 0.3;
      topK = 20;
      topP = 0.8;
    }
    console.log(`Retry attempt ${attempt}: Using temperature=${temperature}, topK=${topK}, topP=${topP}`);
  }

  return { temperature, topK, topP };
}

/**
 * Generate theme data using Gemini API with structured output
 * @param {string} promptText - Full prompt text
 * @param {Object} schema - JSON schema for structured output
 * @param {Object} config - Generation config (temperature, topK, topP)
 * @returns {Object} - Theme response from API
 */
async function generateThemeData(promptText, schema, config) {
  console.log('📝 Step 1: Generating theme data (gemini-2.5-flash-lite)...');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Client': 'genai-js/1.0.0'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: promptText }]
      }],
      generationConfig: {
        temperature: config.temperature,
        topK: config.topK,
        topP: config.topP,
        responseSchema: schema,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Step 1 REST API Error:', response.status, errorData);
    throw new Error(`Step 1 REST API Error: ${response.status} - ${errorData}`);
  }

  const themeResponse = await response.json();

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

  return themeResponse;
}

/**
 * Process theme response and extract theme data
 * @param {Object} apiResponse - API response from Gemini
 * @param {Object|null} backgroundImage - Background image object or null
 * @param {string} themeType - 'image' or 'color'
 * @param {number} attempt - Current attempt number
 * @returns {Object} - Processed result with themeData, backgroundImage, and retry info
 */
function processThemeResponse(apiResponse, backgroundImage, themeType, attempt) {
  const availableFonts = getAvailableFonts();

  // Handle RECITATION finish reason
  if (apiResponse.candidates?.[0]?.finishReason === 'RECITATION') {
    console.log('Received RECITATION finish reason. Retrying with different parameters...');

    if (attempt < MAX_RETRY_ATTEMPTS) {
      return {
        retry: true,
        message: 'Adjusting parameters to avoid RECITATION error...',
        attempt: attempt + 1
      };
    } else {
      return {
        error: 'Model returned RECITATION error repeatedly',
        maxAttemptsReached: true
      };
    }
  }

  // Extract theme data from response
  let themeData = null;
  const parts = apiResponse.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.text) {
      try {
        themeData = JSON.parse(part.text);
        break;
      } catch (e) {
        console.error('✗ JSON parsing error:', e.message);
      }
    }
  }

  if (!themeData) {
    if (attempt < MAX_RETRY_ATTEMPTS) {
      console.log(`No valid theme data found. Retrying... (attempt ${attempt + 1})`);
      return {
        retry: true,
        message: 'No valid theme data received. Retrying...',
        attempt: attempt + 1
      };
    }

    return {
      error: 'Could not parse theme data from Gemini response',
      responseData: {
        finishReason: apiResponse.candidates?.[0]?.finishReason || 'unknown',
        hasContent: !!apiResponse.candidates?.[0]?.content
      },
      maxAttemptsReached: true
    };
  }

  // Check if we need to retry for missing background image
  if (themeType === 'image' && !backgroundImage && attempt < MAX_RETRY_ATTEMPTS) {
    console.log(`No background image was generated. Retrying... (attempt ${attempt + 1})`);

    themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
    themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);

    return {
      retry: true,
      message: 'No background image was generated. Retrying...',
      attempt: attempt + 1,
      themeData: themeData,
      includesThemeData: true
    };
  } else if (themeType === 'image' && !backgroundImage) {
    console.log('No background image was generated after retries. Proceeding with theme data only.');
  } else if (themeType === 'color' && backgroundImage) {
    console.log('Background image was generated even though themeType is color. Ignoring the image.');
    backgroundImage = null;
  }

  // Convert preset names to actual CSS values
  themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
  themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);

  // Check if the selected font is a Google Font
  const selectedFont = availableFonts.find(f => f.name === themeData.font_family);
  if (selectedFont?.isGoogleFont) {
    themeData.isGoogleFont = true;
    themeData.googleFontFamily = selectedFont.googleFontFamily;
    console.log(`🔤 Google Font selected: ${selectedFont.googleFontFamily}`);
  }

  console.log(`✅ Theme Complete: "${themeData.theme_name}" ${backgroundImage ? '+ Background Image' : '(Color Only)'}`);

  const maxAttemptsReached = attempt >= MAX_RETRY_ATTEMPTS && !backgroundImage;

  return {
    themeData,
    backgroundImage,
    maxAttemptsReached,
    noImageAvailable: maxAttemptsReached
  };
}

/**
 * Generate a complete theme (theme data + optional background image)
 * @param {Object} params - Generation parameters
 * @returns {Object} - Generated theme result
 */
async function generateTheme({ prompt, attempt = 0, themeType = 'image' }) {
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  console.log(`🎨 Theme Request: "${prompt}" | ${themeType === 'image' ? 'With Image' : 'Color Only'} | Attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`);

  // Build schema and prompt
  const schema = buildThemeSchema(themeType);
  const promptText = buildPromptText(prompt, themeType);
  const config = getGenerationConfig(attempt, themeType);

  // STEP 1: Generate theme data
  const themeResponse = await generateThemeData(promptText, schema, config);

  // STEP 2: Generate background image (if needed)
  let backgroundImage = null;

  if (themeType === 'image') {
    const themeText = themeResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (themeText) {
      const themeDataFromStep1 = JSON.parse(themeText);
      const imagePrompt = themeDataFromStep1.image_prompt;

      if (imagePrompt?.trim().length > 0) {
        const imageResult = await generateBackgroundImage(imagePrompt);
        if (imageResult) {
          backgroundImage = {
            inlineData: imageResult
          };
        }
      }
    }
  } else {
    console.log('→ Step 2: Skipped (color-only theme)');
  }

  // Create API response structure compatible with existing parsing code
  const apiResponse = {
    candidates: [{
      content: {
        parts: themeResponse.candidates?.[0]?.content?.parts || []
      },
      finishReason: themeResponse.candidates?.[0]?.finishReason
    }]
  };

  // Add background image to parts if generated
  if (backgroundImage) {
    apiResponse.candidates[0].content.parts.push(backgroundImage);
  }

  // Process and return the result
  return processThemeResponse(apiResponse, backgroundImage, themeType, attempt);
}

module.exports = {
  generateTheme
};
