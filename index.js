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
    
    console.log(`Processing theme generation request for prompt: "${prompt}", attempt: ${attempt}, forceJson: ${forceJson}, themeType: ${themeType}`);
    
    // Log additional details for debugging
    if (VERBOSE_LOGGING) {
      console.log(`Request body: ${JSON.stringify({
        prompt,
        attempt,
        forceJson,
        themeType,
        hasPreviousTheme: !!previousThemeData,
        previousThemeName: previousThemeData ? previousThemeData.theme_name : null
      })}`);
      
      // Log client headers for debugging connection issues
      console.log('Client headers:', {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'accept': req.headers.accept
      });
    }
    
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
    
    // Construct the main prompt text
    let mainPromptText = `${prompt_prefix}Create a visually appealing Twitch chat theme for: "${prompt}".\n\nFirst, for the overall theme, consider the feeling and style of "${prompt}".\n\nNext, create the JSON part for the theme settings:\n{\n  "theme_name": "[A creative theme name inspired by '${prompt}']",\n  "background_color": "[rgba color with opacity - e.g., rgba(12, 20, 69, 0.85)]",\n  "border_color": "[hex color - e.g., #ff6bcb]",\n  "text_color": "[hex color for chat text - e.g., #efeff1]",\n  "username_color": "[hex color for usernames - e.g., #9147ff]",\n  "font_family": "[One of: ${fontOptions}]",\n  "border_radius": "[One of: None, Subtle, Rounded, Pill]",\n  "box_shadow": "[One of: None, Soft, Simple 3D, Intense 3D, Sharp]",\n  "description": "[A brief description capturing the essence of a '${prompt}' inspired theme]"\n}\n\n${themeType === 'image' ? `\nThen, design a **subtle, abstract, and seamless background pattern image** that complements the *mood and color palette* of a theme inspired by "${prompt}".\n**Important instructions for the background pattern image:**\n- **DO NOT include any literal words, text, or recognizable objects from the prompt "${prompt}" in the image itself.**\n- The pattern should be purely decorative and abstract.\n- It must tile seamlessly without any visible borders or edges.\n- Use low contrast to ensure text displayed over it remains readable.\n- Keep the design simple with minimal elements.\n- Use a maximum of 2-3 colors that harmonize with the overall theme.\n- Focus on creating a texture or a very simple geometric or organic repeating pattern.\n- Ensure it is borderless and edge-free for perfect tiling.\n- Avoid any elements that could create visible seams when tiled.\nExample ideas for abstract patterns: subtle gradients, soft noise, very simple repeating geometric shapes, or minimalist organic textures. The pattern should evoke the *feeling* of "${prompt}" (e.g., for "futuristic", maybe clean lines or subtle tech patterns; for "cozy", maybe soft textures or simple organic shapes) without directly showing it.\n` : `\nCreate a JSON object with the theme settings.\n- Make sure to use a nice rgba color for the background_color.\n- DO NOT generate any image, only create a color-based theme.`}\n\nQuick font guide:\n- Modern/tech: Tektur, Consolas, System UI\n- Fantasy/medieval: MedievalSharp, Jacquard, EB Garamond\n- Gaming/retro: Press Start 2P, Jacquard, Impact\n- Readable: Atkinson Hyperlegible, Verdana\n- Classic: EB Garamond, Georgia, Times New Roman\n\nBorder radius guide:\n- None (0px): Sharp or pixelated designs\n- Subtle (8px): Slightly rounded corners\n- Rounded (16px): Moderately rounded corners\n- Pill (24px): Playful or cute/soft designs\n\nBox shadow guide:\n- None: Flat designs\n- Soft: Subtle 360 spread\n- Simple 3D: Light layering effect\n- Intense 3D: Strong depth effect\n- Sharp: Pixel-art style\n\nYour response should include both the JSON theme data and, if requested, the background pattern image.\n`;

    const sdkContents = [
      {
        role: "user",
        parts: [ { text: mainPromptText } ]
      }
    ];

    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Use REST API directly (SDK has geographic routing issues)
    let apiResponse;
    try {
      console.log('Using REST API directly with gemini-2.0-flash-preview-image-generation model');
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`, {
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
            responseModalities: themeType === 'image' ? ["TEXT", "IMAGE"] : ["TEXT"]
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('REST API Error:', response.status, errorData);
        throw new Error(`REST API Error: ${response.status} - ${errorData}`);
      }
      
      apiResponse = await response.json();
      console.log('REST API call successful');
    } catch (apiError) {
      console.error('Error calling REST API:', apiError);
      const errorMessage = apiError.message || apiError.toString();
      // Extract more details if the error is an object with a nested error/response
      let errorDetails = 'No additional details';
      if (typeof apiError === 'object' && apiError !== null) {
        if (apiError.cause) errorDetails = JSON.stringify(apiError.cause);
        else if (apiError.response && apiError.response.data) errorDetails = JSON.stringify(apiError.response.data);
        else errorDetails = JSON.stringify(apiError); // Fallback to stringifying the error itself
      }
      console.error('API Error details:', errorDetails);
      return res.status(500).json({
        error: 'Failed to call Gemini API',
        details: errorMessage,
        apiErrorDetails: errorDetails
      });
    }

    // Log the full response for debugging
    console.log('FULL GEMINI RESPONSE (from REST API):');
    console.log(JSON.stringify(apiResponse, null, 4));

    // Adapt the rest of the parsing logic to use apiResponse directly (instead of response = result.response)
    // The rest of the code remains the same, but replace 'response' with 'apiResponse' where needed
    // Check raw response format
    const candidatesCount = apiResponse.candidates?.length || 0;
    const hasContent = apiResponse.candidates?.[0]?.content != null;
    const hasText = hasContent && apiResponse.candidates[0].content.parts?.some(p => p.text);
    const hasImage = hasContent && apiResponse.candidates[0].content.parts?.some(p => p.inlineData?.mimeType?.startsWith('image/'));
    const finishReason = apiResponse.candidates?.[0]?.finishReason || 'unknown';
    
    console.log(`Response structure: candidates=${candidatesCount}, hasContent=${hasContent}, hasText=${hasText}, hasImage=${hasImage}, finishReason=${finishReason}`);
    
    // If there's text, try to log a sample
    if (hasText) {
      const textPart = apiResponse.candidates[0].content.parts.find(p => p.text);
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
      const imagePart = apiResponse.candidates[0].content.parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
      console.log('Image found in response:', imagePart.inlineData.mimeType, 'data length:', imagePart.inlineData.data.length);
    }
    
    console.log('-----------------------------------------------------------------');
    
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
        
        if (attempt < 2) {
          // Try again with completely different parameters for next attempt
          const nextAttempt = attempt + 1;
          
          // Use a more drastic change in parameters when we get a RECITATION error
          if (nextAttempt === 1) {
            // First retry after RECITATION should use very different params
            temperature = 0.3; // Much lower temperature
            topK = 60;  // Much higher topK
            topP = 0.7; // Lower topP
          } else {
            // Second retry after RECITATION
            temperature = 0.7; // Try going higher instead
            topK = 10;  // Much lower topK
            topP = 0.95; // Higher topP
          }
          
          console.log(`RECITATION error - next attempt will use: temp=${temperature}, topK=${topK}, topP=${topP}, seed=${randomSeed + 12345}`);
          
          // Try again with different parameters, but include any previous theme data if we have it
          const responseData = {
            retry: true,
            message: 'Gemini is a bit fussy! Adjusting to get things working...',
            attempt: nextAttempt
          };
          
          // Check if we had a successful previous attempt and include that theme
          if (attempt > 0 && req.body.previousThemeData) {
            responseData.themeData = req.body.previousThemeData;
            console.log('Included previous theme data with retry response');
          }
          
          return res.status(202).json(responseData);
        } else {
          // After max retries, return a meaningful error
          return res.status(400).json({
            error: 'Model returned RECITATION error repeatedly',
            maxAttemptsReached: true
          });
        }
      }
      
      // Process each part of the response
      if (apiResponse.candidates && apiResponse.candidates.length > 0) {
        const parts = apiResponse.candidates[0]?.content?.parts || [];
        
        let extractedThemeData = null;
        
        for (const part of parts) {
          // If it's text, try to extract JSON
          if (part.text) {
            console.log('Found text part in response');
            
            // Try different patterns to extract JSON
            // Look for patterns that look like JSON objects
            const jsonPatterns = [
              // Standard full JSON pattern
              /\{[\s\S]*?\}/g,
              // Relaxed pattern to find partial JSON
              /\{\s*"theme_name"[\s\S]*?\}/g,
              // Another approach looking for the full structure
              /\{\s*"theme_name"[\s\S]*"description"[\s\S]*?\}/g
            ];
            
            let foundValidJson = false;
            
            // Try each pattern in turn
            for (const pattern of jsonPatterns) {
              if (foundValidJson) break;
              
              const matches = part.text.match(pattern);
              if (matches && matches.length > 0) {
                // Try each match, starting with the longest (most likely to be complete)
                const sortedMatches = [...matches].sort((a, b) => b.length - a.length);
                
                for (const match of sortedMatches) {
                  try {
                    // Clean up the JSON string before parsing
                    let jsonStr = match;
                    
                    // Try to fix common JSON issues
                    // Replace non-standard quotes
                    jsonStr = jsonStr.replace(/[""]/g, '"');
                    // Fix missing quotes around keys
                    jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
                    // Replace unescaped backslashes
                    jsonStr = jsonStr.replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2');
                    
                    // Parse the JSON
                    extractedThemeData = JSON.parse(jsonStr);
                    
                    // Validate that it has the expected fields
                    if (extractedThemeData.theme_name && 
                        extractedThemeData.background_color && 
                        extractedThemeData.text_color) {
                      
                      themeData = extractedThemeData; // Set this immediately to ensure we have it even for retries
                      console.log('Successfully parsed theme data:', themeData.theme_name);
                      foundValidJson = true;
                      break;
                    } else {
                      console.log('Found parseable JSON but missing required fields, continuing search');
                    }
                  } catch (e) {
                    console.log(`JSON parsing failed for match: ${e.message}`);
                    // Continue to the next match
                  }
                }
              }
            }
            
            // If all pattern matching failed, try one last approach
            if (!foundValidJson) {
              try {
                // Try to find just the start and end of a JSON object
                const startIdx = part.text.indexOf('{');
                const endIdx = part.text.lastIndexOf('}');
                
                if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                  let jsonStr = part.text.substring(startIdx, endIdx + 1);
                  
                  // Apply the same cleanup as above
                  jsonStr = jsonStr.replace(/[""]/g, '"');
                  jsonStr = jsonStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
                  jsonStr = jsonStr.replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1\\\\$2');
                  
                  themeData = JSON.parse(jsonStr);
                  console.log('Successfully parsed theme data using brute force method:', themeData.theme_name);
                }
              } catch (e3) {
                console.error('All JSON parsing methods failed:', e3.message);
                // All parsing attempts failed
              }
            }
            
            // Log the failure if we couldn't find valid JSON
            if (!themeData) {
              console.warn('No valid JSON object found in text part');
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
        // Check if we have a background image when themeType is 'image' and this isn't a high-attempt retry
        if (themeType === 'image' && !backgroundImage && attempt < 2) {
          console.log(`No background image was generated. Retrying with increased temperature... (attempt ${attempt + 1})`);
          
          // Add CSS values to theme data for consistent experience between attempts
          themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
          themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);
          
          // Debug output for the theme data 
          console.log('Theme data for retry:', JSON.stringify({
            theme_name: themeData.theme_name,
            containsValues: !!themeData.border_radius_value
          }));
          
          // Retry with modified parameters to encourage image generation but also return the theme data
          // This allows clients to show intermediate themes while waiting for one with an image
          return res.status(202).json({
            retry: true,
            message: `No background image was generated. Retrying (attempt ${attempt + 1}/2)...`,
            attempt: attempt + 1,
            themeData: themeData, // Include the theme data so client can use it while retrying
            includesThemeData: true // Extra flag to make it super obvious we have theme data
          });
        } else if (themeType === 'image' && !backgroundImage) {
          // After all retries, proceed with the theme data without an image
          console.log('No background image was generated after multiple attempts. Proceeding with theme data only.');
        } else if (themeType === 'color' && backgroundImage) {
          console.log('Background image was generated even though themeType is color. Ignoring the image.');
          backgroundImage = null; // Ignore the image for color-only themes
        }
        
        // Validate that the font exists in our list
        const fontEntry = availableFonts.find(font => font.name === themeData.font_family);
        
        if (!fontEntry) {
          // If font doesn't exist, default to System UI
          themeData.font_family = 'System UI';
          console.warn(`Invalid font '${themeData.font_family}' replaced with 'System UI'`);
        }
        
        // Validate border radius and box shadow values
        if (!Object.keys(borderRadiusPresets).includes(themeData.border_radius)) {
          // Default to Subtle if invalid or missing
          themeData.border_radius = 'Subtle';
          console.warn(`Invalid border radius '${themeData.border_radius}' replaced with 'Subtle'`);
        }
        
        if (!Object.keys(boxShadowPresets).includes(themeData.box_shadow)) {
          // Default to Soft if invalid or missing
          themeData.box_shadow = 'Soft';
          console.warn(`Invalid box shadow '${themeData.box_shadow}' replaced with 'Soft'`);
        }
        
        // Convert preset names to actual CSS values
        themeData.border_radius_value = getBorderRadiusValue(themeData.border_radius);
        themeData.box_shadow_value = getBoxShadowValue(themeData.box_shadow);
        
        // Update the theme data in the original response to keep it consistent
        for (const part of apiResponse.candidates[0].content.parts) {
          if (part.text) {
            const jsonMatch = part.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const updatedJsonText = part.text.replace(jsonMatch[0], JSON.stringify(themeData, null, 2));
                part.text = updatedJsonText;
              } catch (e) {
                console.error('Error updating theme data in response JSON:', e);
              }
            }
          }
        }
        
        // Log theme selections
        console.log('Font selected:', themeData.font_family);
        console.log('Border Radius:', themeData.border_radius, `(${themeData.border_radius_value})`);
        console.log('Box Shadow:', themeData.box_shadow, `(${themeData.box_shadow_value.substring(0, 30)}...)`); // Log a snippet of the longer box shadow values
        
        // Return properly structured response with themeData
        console.log(`Successfully formatted response with theme "${themeData.theme_name}" and ${backgroundImage ? 'background image' : 'no background image'}`);
        
        // If we've made the maximum number of attempts but still don't have an image,
        // add that information to the response so clients know not to wait for an image
        const maxAttemptsReached = attempt >= 2 && !backgroundImage;
        
        return res.json({
          themeData: themeData,
          backgroundImage: backgroundImage,
          maxAttemptsReached: maxAttemptsReached,
          noImageAvailable: maxAttemptsReached
        });
      }
      
      // If we can't extract valid JSON but we have an existing theme and less than max retries,
      // retry with different params
      if (attempt < 2) {
        console.log(`No valid theme data found. Unleashing creative force... (attempt ${attempt + 1})`);
        return res.status(202).json({
          retry: true,
          message: `No valid theme data received. Retrying (attempt ${attempt + 1}/2)...`,
          attempt: attempt + 1
        });
      }
      
      // If we've already retried the max number of times, return an error
      return res.status(400).json({ 
        error: 'Could not parse theme data from Gemini response',
        responseData: {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
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

// Test endpoint to verify Gemini API key and basic functionality
app.get('/api/test-gemini', async (req, res) => {
  try {
    if (!GoogleGenAI || !Modality) {
      return res.status(503).json({ error: 'SDK not loaded' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    
    // Test with the image generation model using SDK
    const testResponse = await genAI.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: "Create a simple red circle image",
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE]
      }
    });

    const hasText = testResponse.response?.candidates?.[0]?.content?.parts?.some(p => p.text);
    const hasImage = testResponse.response?.candidates?.[0]?.content?.parts?.some(p => p.inlineData);

    res.json({
      success: true,
      apiKeyConfigured: true,
      sdkLoaded: true,
      hasText,
      hasImage,
      partsCount: testResponse.response?.candidates?.[0]?.content?.parts?.length || 0,
      apiMethod: 'SDK',
      testResponse: testResponse.response?.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 100) || 'No text response'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Gemini API test failed',
      details: error.message,
      apiKeyConfigured: !!GEMINI_API_KEY,
      sdkLoaded: !!(GoogleGenAI && Modality),
      apiMethod: 'SDK'
    });
  }
});

// Test endpoint specifically for image generation model using REST API
app.get('/api/test-image-model', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Test with REST API directly
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: "Create a simple blue square image" }]
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"]
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(500).json({
        error: 'REST API test failed',
        details: errorData,
        status: response.status,
        apiKeyConfigured: !!GEMINI_API_KEY
      });
    }

    const testResponse = await response.json();
    const hasText = testResponse.candidates?.[0]?.content?.parts?.some(p => p.text);
    const hasImage = testResponse.candidates?.[0]?.content?.parts?.some(p => p.inlineData);

    res.json({
      success: true,
      modelWorking: true,
      hasText,
      hasImage,
      partsCount: testResponse.candidates?.[0]?.content?.parts?.length || 0,
      apiMethod: 'REST'
    });

  } catch (error) {
    res.status(500).json({
      error: 'Image generation model test failed',
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