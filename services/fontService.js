// services/fontService.js
const { initialFonts } = require('../config/fonts');
const { GOOGLE_FONTS_API_KEY } = require('../config/constants');

// Available fonts list - will be populated with Google Fonts
let availableFonts = [...initialFonts];

/**
 * Fetches top trending fonts from Google Fonts API and merges them with availableFonts.
 */
async function fetchGoogleFonts() {
  if (!GOOGLE_FONTS_API_KEY) {
    console.log('ℹ️ Google Fonts API Key not found. Using default font list.');
    return;
  }

  try {
    console.log('Fetching fonts from Google Fonts API...');
    const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`);

    if (!response.ok) {
      throw new Error(`Google Fonts API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.items && Array.isArray(data.items)) {
      // Take top 50 popular fonts to avoid overwhelming the context
      const googleFonts = data.items.slice(0, 50).map(font => ({
        name: font.family,
        value: `'${font.family}', ${font.category}, sans-serif`, // Fallback to category
        description: `Google Font: ${font.category}`,
        isGoogleFont: true,
        googleFontFamily: font.family,
        category: font.category
      }));

      // Merge with existing fonts, ensuring no duplicates by name
      const existingNames = new Set(availableFonts.map(f => f.name));

      let addedCount = 0;
      googleFonts.forEach(gf => {
        if (!existingNames.has(gf.name)) {
          availableFonts.push(gf);
          existingNames.add(gf.name);
          addedCount++;
        }
      });

      console.log(`✅ Added ${addedCount} Google Fonts to the available list.`);
    }
  } catch (error) {
    console.error('❌ Failed to fetch Google Fonts:', error.message);
  }
}

/**
 * Get all available fonts
 * @returns {Array} - Array of font objects
 */
function getAvailableFonts() {
  return availableFonts;
}

module.exports = {
  fetchGoogleFonts,
  getAvailableFonts
};
