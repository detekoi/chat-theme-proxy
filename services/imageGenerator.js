// services/imageGenerator.js
const { v4: uuidv4 } = require('uuid');
const { RUNWARE_API_KEY } = require('../config/constants');

/**
 * Generate background image using Runware API (FLUX.1 Schnell)
 * @param {string} imagePrompt - Prompt for image generation
 * @returns {Object|null} - Image object with mimeType and base64 data, or null if failed
 */
async function generateBackgroundImage(imagePrompt) {
  if (!imagePrompt || imagePrompt.trim().length === 0) {
    console.log('→ Image generation skipped (no image prompt)');
    return null;
  }

  if (!RUNWARE_API_KEY) {
    console.log('→ Image generation skipped (RUNWARE_API_KEY not configured)');
    return null;
  }

  try {
    console.log(`🖼️  Generating background image (Runware FLUX.1 Schnell)...`);

    // Prepare Runware API request
    const taskUUID = uuidv4();
    const runwareRequest = [{
      taskType: "imageInference",
      taskUUID: taskUUID,
      positivePrompt: imagePrompt,
      width: 512,
      height: 512,
      model: "runware:100@1", // FLUX.1 Schnell
      steps: 4, // Schnell is optimized for 1-4 steps
      CFGScale: 3.0, // Lower CFG for subtle patterns
      numberResults: 1,
      outputType: "base64Data",
      outputFormat: "PNG"
    }];

    const imageGenResponse = await fetch('https://api.runware.ai/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RUNWARE_API_KEY}`
      },
      body: JSON.stringify(runwareRequest)
    });

    if (!imageGenResponse.ok) {
      const errorData = await imageGenResponse.text();
      console.log(`✗ Image generation failed (${imageGenResponse.status}): ${errorData}`);
      return null;
    }

    const runwareResponse = await imageGenResponse.json();

    // Extract base64 image data from Runware response
    if (runwareResponse?.data?.length > 0 && runwareResponse.data[0].imageBase64Data) {
      const base64Data = runwareResponse.data[0].imageBase64Data;
      const imageSize = Math.round(base64Data.length / 1024);
      console.log(`✓ Background image generated (${imageSize}KB)`);

      return {
        mimeType: 'image/png',
        data: base64Data
      };
    } else {
      console.log('✗ No image in response');
      console.log('Response structure:', JSON.stringify({
        hasData: !!runwareResponse?.data,
        dataIsArray: Array.isArray(runwareResponse?.data),
        dataLength: runwareResponse?.data?.length,
        firstItemKeys: runwareResponse?.data?.[0] ? Object.keys(runwareResponse.data[0]) : 'N/A'
      }));
      return null;
    }
  } catch (error) {
    console.log(`✗ Image generation error: ${error.message}`);
    return null;
  }
}

module.exports = {
  generateBackgroundImage
};
