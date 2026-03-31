// services/fontService.js
const { initialFonts } = require('../config/fonts');
const { GOOGLE_FONTS_API_KEY } = require('../config/constants');
const { Firestore, Timestamp } = require('@google-cloud/firestore');

// Available fonts list - top popular fonts merged with initial
let availableFonts = [...initialFonts];

// Full Google Fonts catalog for search (populated on boot)
let allGoogleFonts = [];

// Firestore Configuration
const FIRESTORE_COLLECTION_NAME = process.env.FIRESTORE_CACHE_COLLECTION || 'cache';
const GOOGLE_FONTS_DOC_ID = 'google-fonts';

// Cache TTL (in seconds) - default 90 days (fonts rarely change, so cache for a long time)
const GOOGLE_FONTS_TTL_SECONDS = parseInt(process.env.GOOGLE_FONTS_TTL) || 90 * 24 * 60 * 60; // 90 days

// Initialize Firestore
const firestore = new Firestore();

/**
 * Gets Google Fonts from Firestore cache.
 * @returns {Promise<Array|null>} The cached fonts array or null if not found or expired.
 */
async function loadGoogleFontsFromCache() {
  try {
    const docRef = firestore.collection(FIRESTORE_COLLECTION_NAME).doc(GOOGLE_FONTS_DOC_ID);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      const cacheEntry = docSnap.data();
      if (cacheEntry.expiresAt && cacheEntry.expiresAt.toMillis() > Date.now()) {
        console.log(`Using cached Google Fonts from Firestore doc: ${GOOGLE_FONTS_DOC_ID}`);
        return JSON.parse(cacheEntry.data); // Assuming data is stored as JSON string
      } else {
        console.log(`Cache expired or missing expiresAt for Firestore doc: ${GOOGLE_FONTS_DOC_ID}`);
        // Optionally delete expired doc
        await docRef.delete().catch(err => console.warn(`Failed to delete expired doc ${GOOGLE_FONTS_DOC_ID}:`, err));
      }
    }
  } catch (err) {
    console.warn(`Firestore GET error for doc ${GOOGLE_FONTS_DOC_ID}:`, err);
  }
  return null;
}

/**
 * Saves Google Fonts to Firestore cache.
 * @param {Array} fonts The fonts array to cache (will be JSON stringified).
 * @param {number} ttlSeconds Time to live in seconds (optional, uses default if not provided).
 */
async function saveGoogleFontsToCache(fonts, ttlSeconds = GOOGLE_FONTS_TTL_SECONDS) {
  try {
    const docRef = firestore.collection(FIRESTORE_COLLECTION_NAME).doc(GOOGLE_FONTS_DOC_ID);
    const expiresAt = Timestamp.fromMillis(Date.now() + ttlSeconds * 1000);
    await docRef.set({
      data: JSON.stringify(fonts),
      expiresAt: expiresAt,
    });
    console.log(`Successfully cached Google Fonts for Firestore doc: ${GOOGLE_FONTS_DOC_ID} with TTL: ${ttlSeconds}s`);
  } catch (err) {
    console.error(`Firestore SET error for doc ${GOOGLE_FONTS_DOC_ID}:`, err);
  }
}

/**
 * Fetches top trending fonts from Google Fonts API and merges them with availableFonts.
 * Only fetches if not already cached in Firestore.
 */
async function fetchGoogleFonts() {
  if (!GOOGLE_FONTS_API_KEY) {
    console.log('ℹ️ Google Fonts API Key not found. Using default font list.');
    return;
  }

  // Try to load from cache first
  const cachedFonts = await loadGoogleFontsFromCache();
  if (cachedFonts && Array.isArray(cachedFonts) && cachedFonts.length > 0) {
    // Store full catalog in memory for search
    allGoogleFonts = cachedFonts;

    // Merge only top 100 into served list, ensuring no duplicates by name
    const topFonts = cachedFonts.slice(0, 100);
    const existingNames = new Set(availableFonts.map(f => f.name));
    let addedCount = 0;
    
    topFonts.forEach(gf => {
      if (!existingNames.has(gf.name)) {
        availableFonts.push(gf);
        existingNames.add(gf.name);
        addedCount++;
      }
    });
    
    console.log(`✅ Loaded ${addedCount} Google Fonts from cache (top 100 of ${cachedFonts.length} total).`);
    return;
  }

  // Not in cache, fetch from API
  try {
    console.log('Fetching fonts from Google Fonts API...');
    const response = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`);

    if (!response.ok) {
      throw new Error(`Google Fonts API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.items && Array.isArray(data.items)) {
      // Map ALL fonts for the searchable catalog
      const googleFonts = data.items.map(font => ({
        name: font.family,
        value: `'${font.family}', ${font.category}, sans-serif`, // Fallback to category
        description: `Google Font: ${font.category}`,
        isGoogleFont: true,
        googleFontFamily: font.family,
        category: font.category
      }));

      // Store full catalog in memory for search
      allGoogleFonts = googleFonts;

      // Merge top 100 popular fonts into the available list
      const topFonts = googleFonts.slice(0, 100);
      const existingNames = new Set(availableFonts.map(f => f.name));

      let addedCount = 0;
      topFonts.forEach(gf => {
        if (!existingNames.has(gf.name)) {
          availableFonts.push(gf);
          existingNames.add(gf.name);
          addedCount++;
        }
      });

      console.log(`✅ Added ${addedCount} Google Fonts to the available list (top 100 of ${googleFonts.length} total).`);
      
      // Save full catalog to cache for next time
      await saveGoogleFontsToCache(googleFonts);
    }
  } catch (error) {
    console.error('❌ Failed to fetch Google Fonts:', error.message);
  }
}

/**
 * Get all available fonts (top 100 popular + custom/system)
 * @returns {Array} - Array of font objects
 */
function getAvailableFonts() {
  return availableFonts;
}

/**
 * Search the full Google Fonts catalog by name.
 * @param {string} query - Search query (case-insensitive substring match)
 * @param {number} [limit=10] - Maximum number of results to return
 * @returns {Array} - Matching font objects
 */
function searchGoogleFonts(query, limit = 10) {
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return [];
  }

  const q = query.trim().toLowerCase();

  // Search full catalog (includes all ~1,700 fonts)
  // Also search the initial/custom fonts
  const allFonts = [...initialFonts, ...allGoogleFonts];

  // Deduplicate by name
  const seen = new Set();
  const results = [];

  for (const font of allFonts) {
    if (seen.has(font.name)) continue;
    seen.add(font.name);

    if (font.name.toLowerCase().includes(q)) {
      results.push(font);
      if (results.length >= limit) break;
    }
  }

  return results;
}

module.exports = {
  fetchGoogleFonts,
  getAvailableFonts,
  searchGoogleFonts
};
