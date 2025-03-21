// index.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get port from environment variable
const PORT = process.env.PORT || 8091;

// Get API key from environment variable
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define available fonts
const availableFonts = [
    // Custom fonts
    { name: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', sans-serif", description: 'Designed for high legibility and reading clarity, especially at small sizes.', custom: true },
    { name: 'Tektur', value: "'Tektur', sans-serif", description: 'Modern and slightly angular typeface with a technical/sci-fi aesthetic.', custom: true },
    { name: 'Medieval Sharp', value: "'MedievalSharp', cursive", description: 'Evokes a medieval/fantasy atmosphere with calligraphic details.', custom: true },
    { name: 'Press Start 2P', value: "'Press Start 2P', cursive", description: 'Pixelated retro gaming font that resembles 8-bit text.', custom: true },
    { name: 'Jacquard 12', value: "'Jacquard', monospace", description: 'Clean monospaced font inspired by classic computer terminals.', custom: true },
    
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
    { name: 'Garamond', value: "Garamond, Baskerville, 'Baskerville Old Face', serif", description: 'Classical serif with elegant proportions.' },
    
    // Monospace fonts
    { name: 'Courier New', value: "'Courier New', Courier, monospace", description: 'Classic monospaced font resembling typewriter text.' },
    { name: 'Consolas', value: "Consolas, monaco, monospace", description: 'Modern monospaced font designed for coding.' },
    { name: 'Lucida Console', value: "'Lucida Console', Monaco, monospace", description: 'Clear monospace font with good readability.' },
    
    // Display/Decorative fonts that are commonly available
    { name: 'Impact', value: "Impact, Haettenschweiler, sans-serif", description: 'Bold condensed sans-serif font, often used for headlines.' },
    { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive", description: 'Casual script-like font with a friendly appearance.' },
    { name: 'Arial Black', value: "'Arial Black', Gadget, sans-serif", description: 'Extra bold version of Arial for strong emphasis.' }
];

// Define theme generation endpoint
app.post('/api/generate-theme', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Generate list of available font names for the prompt
    const fontOptions = availableFonts.map(font => `'${font.name}'`).join(', ');
    
    // Call Gemini API with server-side key
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: `Create a visually appealing Twitch chat theme based on: "${prompt}". The theme should be cohesive and convey the vibe/aesthetic of this prompt. 

Provide the following in JSON format with these exact fields:\n
{\n  "theme_name": "[A short catchy name for this theme]",\n  "background_color": "[rgba color with opacity - e.g., rgba(12, 20, 69, 0.85)]",\n  "border_color": "[hex color or 'transparent' - e.g., #ff6bcb]",\n  "text_color": "[hex color for chat text - e.g., #efeff1]",\n  "username_color": "[hex color for usernames - e.g., #9147ff]",\n  "font_family": "[Select one of these font names: ${fontOptions}]",\n  "description": "[A short 1-2 sentence description of the theme]"\n}

When choosing fonts, consider:
- For modern/tech themes: 'Tektur', 'Consolas', 'Jacquard 12', 'Tahoma'
- For fantasy/medieval: 'Medieval Sharp', 'Palatino', 'Garamond'
- For gaming/retro: 'Press Start 2P', 'Arial Black', 'Impact'
- For readability: 'Atkinson Hyperlegible', 'Verdana', 'System UI'
- For classic/elegant: 'Georgia', 'Times New Roman'
- For playful/casual: 'Comic Sans MS', 'Trebuchet MS'

The font should match the overall aesthetic of the theme.`
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }
    );
    
    // Try to extract the theme data from the response
    try {
      const responseText = response.data.candidates[0]?.content?.parts[0]?.text;
      if (responseText) {
        // Extract JSON object from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const themeData = JSON.parse(jsonMatch[0]);
          
          // Validate the font is in our list
          const fontExists = availableFonts.some(font => font.name === themeData.font_family);
          
          if (!fontExists) {
            // If font doesn't exist, default to System UI
            themeData.font_family = 'System UI';
            console.warn(`Invalid font '${themeData.font_family}' replaced with 'System UI'`);
          }
          
          // Return the validated theme data
          return res.json({ 
            ...response.data,
            themeData 
          });
        }
      }
      
      // If we can't extract valid JSON, return the raw response
      res.json(response.data);
    } catch (jsonError) {
      console.error('Error parsing theme JSON:', jsonError);
      // Return the original response if we can't parse the JSON
      res.json(response.data);
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Theme Generator API is running');
});

// Serve the test page from the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test-gemini-api.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});