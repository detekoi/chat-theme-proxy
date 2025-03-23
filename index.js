// index.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

const app = express();
app.use(cors());
app.use(express.json());

// Only serve static files and test interface in development mode
if (isDevelopment) {
  console.log('Running in development mode with test interface enabled');
  app.use(express.static(path.join(__dirname, 'public')));
}

// Get port from environment variable
const PORT = process.env.PORT || 8091;

// Get API key from environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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
  try {
    const { prompt, attempt = 0, forceJson = false } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    console.log(`Processing theme generation request for prompt: "${prompt}", attempt: ${attempt}, forceJson: ${forceJson}`);
    
    // Generate list of available font names for the prompt
    const fontOptions = availableFonts.map(font => `'${font.name}'`).join(', ');
    
    // Adjust parameters based on attempt number to improve retry chances
    let temperature = 0.5;
    let topK = 20;
    let topP = 0.9;
    let prompt_prefix = '';
    
    // If we're retrying, adjust the params to avoid RECITATION
    if (attempt > 0) {
      // Adjust temperature based on attempt number
      if (attempt === 1) {
        temperature = 0.7; // Higher temperature on first retry
        topK = 30;
        prompt_prefix = 'Please use exactly this format (JSON object): ';
      } else if (attempt >= 2) {
        temperature = 0.3; // Lower temperature on subsequent retries for more deterministic output
        topK = 10;
        prompt_prefix = 'RESPOND WITH ONLY A JSON OBJECT in this exact format: ';
      }
      
      console.log(`Retry attempt ${attempt}: Using temperature=${temperature}, topK=${topK}`);
    }
    
    // Call Gemini API with server-side key and modified prompt for better results
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `${prompt_prefix}You are a design assistant that creates Twitch chat themes based on user prompts. Create a visually appealing Twitch chat theme based on: "${prompt}". The theme should be cohesive and convey the vibe/aesthetic of this prompt.

YOU MUST RESPOND WITH VALID JSON. NOTHING ELSE. Create this JSON object with these EXACT fields and nothing else:

{
  "theme_name": "[A short catchy name for this theme]",
  "background_color": "[rgba color with opacity - e.g., rgba(12, 20, 69, 0.85)]",
  "border_color": "[hex color or 'transparent' - e.g., #ff6bcb]",
  "text_color": "[hex color for chat text - e.g., #efeff1]",
  "username_color": "[hex color for usernames - e.g., #9147ff]",
  "font_family": "[One of these font names: ${fontOptions}]",
  "description": "[A short 1-2 sentence description of the theme]"
}

Rules:
1. Respond ONLY with the JSON object described above.
2. Do NOT add any other text.
3. Make sure the colors work well together and match the aesthetic of "${prompt}".
4. When choosing fonts, consider:
   - For modern/tech themes: 'Tektur', 'Consolas', 'System UI'
   - For fantasy/medieval: 'MedievalSharp', 'Jacquard', 'EB Garamond'
   - For gaming/retro: 'Press Start 2P', 'Jacquard', 'Impact'
   - For readability: 'Atkinson Hyperlegible', 'Verdana', 'System UI'
   - For classic/elegant: 'EB Garamond', 'Georgia', 'Times New Roman'

IMPORTANT: Additionally, create a subtle tiled background image pattern that matches this theme's aesthetic. The pattern should be subtle enough not to interfere with text readability, small enough for a default size of 320 x 600 (and even smaller in Popup mode), and should complement the theme's background color.`
          }]
        }],
        generationConfig: {
          temperature: temperature,
          topK: topK,
          topP: topP,
          maxOutputTokens: 1024,
          responseModalities: ['Text', 'Image'] // Enable image generation
        }
      }
    );
    
    // Log a detailed version of the response
    console.log('Gemini response received with status:', response.status, response.statusText);
    console.log('-----------------------------------------------------------------');
    console.log('DETAILED RESPONSE ANALYSIS:');
    
    // Check raw response format
    const candidatesCount = response.data.candidates?.length || 0;
    const hasContent = response.data.candidates?.[0]?.content != null;
    const hasText = hasContent && response.data.candidates[0].content.parts?.some(p => p.text);
    const hasImage = hasContent && response.data.candidates[0].content.parts?.some(p => p.inlineData?.mimeType?.startsWith('image/'));
    const finishReason = response.data.candidates?.[0]?.finishReason || 'unknown';
    
    console.log(`Response structure: candidates=${candidatesCount}, hasContent=${hasContent}, hasText=${hasText}, hasImage=${hasImage}, finishReason=${finishReason}`);
    
    // If there's text, try to log a sample
    if (hasText) {
      const textPart = response.data.candidates[0].content.parts.find(p => p.text);
      if (textPart) {
        // Log a small sample of the text content
        const sampleText = textPart.text.substring(0, 200);
        console.log('Sample text from response:', sampleText + '...');
        
        // Check for JSON pattern
        const jsonMatch = textPart.text.match(/\{[\s\S]*\}/);
        console.log('Contains JSON object:', jsonMatch ? 'YES' : 'NO');
        
        if (jsonMatch) {
          try {
            const testParse = JSON.parse(jsonMatch[0]);
            console.log('JSON parse test succeeded, contains keys:', Object.keys(testParse).join(', '));
          } catch (e) {
            console.log('JSON parse test failed:', e.message);
          }
        }
      }
    }
    
    // Log if an image was generated
    if (hasImage) {
      const imagePart = response.data.candidates[0].content.parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
      console.log('Image found in response:', imagePart.inlineData.mimeType, 'data length:', imagePart.inlineData.data.length);
    }
    
    console.log('-----------------------------------------------------------------');
    
    // Extract the theme data and image from the response
    try {
      // Initialize variables
      let themeData = null;
      let backgroundImage = null;
      
      // Print the entire response structure for debugging
      console.log('FULL GEMINI RESPONSE:');
      console.log(JSON.stringify(response.data, null, 2));
      
      // Process each part of the response
      if (response.data.candidates && response.data.candidates.length > 0) {
        const parts = response.data.candidates[0]?.content?.parts || [];
        
        for (const part of parts) {
          // If it's text, try to extract JSON
          if (part.text) {
            console.log('Found text part in response');
            
            // Try different patterns to extract JSON
            // 1. Standard regex pattern
            const jsonMatch = part.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                themeData = JSON.parse(jsonMatch[0]);
                console.log('Successfully parsed theme data (method 1):', themeData.theme_name);
              } catch (e) {
                console.error('Failed to parse JSON from text (method 1):', e.message);
                
                // Try some fallback methods
                try {
                  // 2. Try to find just the start and end of a JSON object
                  const startIdx = part.text.indexOf('{');
                  const endIdx = part.text.lastIndexOf('}');
                  
                  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                    const jsonStr = part.text.substring(startIdx, endIdx + 1);
                    themeData = JSON.parse(jsonStr);
                    console.log('Successfully parsed theme data (method 2):', themeData.theme_name);
                  }
                } catch (e2) {
                  console.error('Failed to parse JSON from text (method 2):', e2.message);
                  
                  // 3. Try with a more aggressive cleanup
                  try {
                    // Remove any non-JSON content outside the braces
                    if (startIdx !== -1 && endIdx !== -1) {
                      let jsonStr = part.text.substring(startIdx, endIdx + 1);
                      
                      // Replace any potential invalid characters that might break JSON parsing
                      jsonStr = jsonStr.replace(/\\n/g, '\n')
                                       .replace(/\\r/g, '\r')
                                       .replace(/\\t/g, '\t')
                                       .replace(/\\'/g, "'")
                                       .replace(/\\\"/g, '"');
                                       
                      themeData = JSON.parse(jsonStr);
                      console.log('Successfully parsed theme data (method 3):', themeData.theme_name);
                    }
                  } catch (e3) {
                    console.error('Failed to parse JSON from text (method 3):', e3.message);
                    // All parsing attempts failed
                  }
                }
              }
            } else {
              console.warn('No JSON pattern found in text part');
              console.log('Text content sample:', part.text.substring(0, 200) + '...');
            }
          } // Close if part.text
          // If it's an image, extract the data
          else if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('image/')) {
            backgroundImage = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data // This is base64 encoded image data
            };
            console.log('Successfully parsed background image of type:', part.inlineData.mimeType);
          }
        }
      }
      if (themeData) {
        // Validate that the font exists in our list
        const fontEntry = availableFonts.find(font => font.name === themeData.font_family);
        
        if (!fontEntry) {
          // If font doesn't exist, default to System UI
          themeData.font_family = 'System UI';
          console.warn(`Invalid font '${themeData.font_family}' replaced with 'System UI'`);
          
          // Update the theme data in the original response to keep it consistent
          for (const part of response.data.candidates[0].content.parts) {
            if (part.text) {
              const jsonMatch = part.text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const updatedJsonText = part.text.replace(jsonMatch[0], JSON.stringify(themeData, null, 2));
                  part.text = updatedJsonText;
                } catch (e) {
                  console.error('Error updating font in response JSON:', e);
                }
              }
            }
          }
        }
        
        // Log the font that was selected
        console.log('Font selected:', themeData.font_family);
        
        // Return properly structured response with themeData
        console.log(`Successfully formatted response with theme "${themeData.theme_name}" and ${backgroundImage ? 'background image' : 'no background image'}`);
        return res.json({
          themeData: themeData,
          backgroundImage: backgroundImage
        });
      }
      
      // If we can't extract valid JSON, return a detailed error to support retry logic
      return res.status(400).json({ 
        error: 'Could not parse theme data from Gemini response',
        responseData: {
          status: response.status,
          statusText: response.statusText,
          finishReason: finishReason,
          hasContent: hasContent,
          hasText: hasText,
          hasImage: hasImage
        }
      });
    } catch (jsonError) {
      console.error('Error parsing theme JSON or extracting image:', jsonError);
      // Return a properly formatted error response
      res.status(400).json({ 
        error: 'Error parsing theme data', 
        details: jsonError.message,
        partialData: response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 200) || 'No text data found'
      });
    }
    
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ 
      error: 'Failed to generate theme',
      details: error.response?.data?.error || error.message 
    });
  }
});

// Endpoint to get all available fonts
app.get('/api/fonts', (req, res) => {
  res.json(availableFonts);
});

// Debug endpoint to check server status and configuration
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'running',
    geminiApiKeyConfigured: !!GEMINI_API_KEY,
    apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    fontCount: availableFonts.length,
    environment: process.env.NODE_ENV || 'development',
    memoryUsage: process.memoryUsage(),
    serverUptime: process.uptime()
  });
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});