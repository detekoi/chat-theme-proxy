// routes/themeLibraryRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getLibrary, addTheme, deleteTheme } = require('../services/themeLibraryService');
const { uploadDataUrlToGCS, deleteImagesForTheme } = require('../services/storageService');
const { createTokenLimiter, validateToken } = require('../middleware/tokenValidation');

const router = express.Router();

// Own limiter instance, separate from the scene-config budget so saving scenes and
// building a theme library don't starve each other. Higher ceiling because adding
// and pruning themes is a burstier action than saving a scene.
const tokenLimiter = createTokenLimiter({ max: 60 });

// Middleware: Route-scoped body parser up to 1MB (overriding global limit for base64 background image data URLs)
const jsonParser = express.json({ limit: '1mb' });

// Every key an AI-generated theme may carry. Unknown keys are dropped so this
// endpoint can't be used as an arbitrary public JSON store.
const ALLOWED_THEME_KEYS = new Set([
  'name', 'value', 'description', 'bgColor', 'bgColorOpacity', 'borderColor', 'textColor',
  'usernameColor', 'timestampColor', 'pronounBadgeColor', 'fontFamily', 'isGoogleFont',
  'googleFontFamily', 'borderRadius', 'borderRadiusValue', 'boxShadow', 'boxShadowValue',
  'textShadow', 'backgroundImage', 'bgImageOpacity', 'topFade', 'isGenerated',
  // Variant bookkeeping: without these surviving the round-trip, a re-generated
  // prompt that produces the same theme_name gets no "(Variant N)" suffix, its
  // name collides with the stored copy, and the client's dedupe-by-name silently
  // refuses to insert it — which is how "apply" ended up falling back to the
  // default theme.
  'originalThemeName', 'variant'
]);

function sanitizeTheme(theme) {
  const sanitized = {};
  for (const key of Object.keys(theme)) {
    if (ALLOWED_THEME_KEYS.has(key)) {
      sanitized[key] = theme[key];
    }
  }
  return sanitized;
}

// GET /api/theme-library/:token
router.get('/theme-library/:token', validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const library = await getLibrary(token);

    // First-run clients need no special branch: an unknown token simply
    // resolves to an empty theme list rather than a 404.
    return res.status(200).json({ themes: library.themes });
  } catch (err) {
    console.error('[themeLibraryRoutes] Error retrieving theme library:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve theme library.' });
  }
});

// POST /api/theme-library/:token/themes
router.post('/theme-library/:token/themes', tokenLimiter, jsonParser, validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const body = req.body || {};

    if (!body.theme || typeof body.theme !== 'object' || Array.isArray(body.theme)) {
      return res.status(400).json({ error: 'Missing or invalid "theme" object in payload.' });
    }

    let theme = sanitizeTheme(body.theme);

    if (!theme.value || typeof theme.value !== 'string') {
      return res.status(400).json({ error: 'Theme is missing a required "value" field.' });
    }

    // Assign a stable theme ID. The `id` key is not in ALLOWED_THEME_KEYS so a client
    // can never inject or overwrite one; every add is assigned a fresh server-side UUID
    // that stays attached to this theme entry for future deletes.
    const themeId = uuidv4();
    theme.id = themeId;

    // Automatically convert base64 backgroundImage data URLs to Cloud Storage public HTTPS URLs
    if (theme.backgroundImage && typeof theme.backgroundImage === 'string' && theme.backgroundImage.startsWith('data:image/')) {
      const gcsUrl = await uploadDataUrlToGCS(theme.backgroundImage, themeId, `theme-backgrounds/${token}/`);
      if (gcsUrl) {
        theme.backgroundImage = gcsUrl;
      }
    }

    const MAX_BYTES = 900 * 1024; // 900 KB limit for Firestore doc safety
    let payloadString = JSON.stringify(theme);

    if (Buffer.byteLength(payloadString, 'utf8') > MAX_BYTES) {
      // Fallback: strip backgroundImage data URL if payload still exceeds limit
      if (theme.backgroundImage) {
        theme.backgroundImage = null;
        payloadString = JSON.stringify(theme);
      }

      if (Buffer.byteLength(payloadString, 'utf8') > MAX_BYTES) {
        return res.status(413).json({ error: 'Theme payload exceeds maximum 900 KB limit.' });
      }
    }

    const savedTheme = await addTheme(token, theme);

    return res.status(200).json({ success: true, theme: savedTheme });
  } catch (err) {
    console.error('[themeLibraryRoutes] Error adding theme:', err.message);
    return res.status(500).json({ error: 'Failed to add theme to library.' });
  }
});

// DELETE /api/theme-library/:token/themes/:themeId
router.delete('/theme-library/:token/themes/:themeId', tokenLimiter, validateToken, async (req, res) => {
  try {
    const { token, themeId } = req.params;
    // deleteTheme matches on id or value and reports back the real id, since GCS
    // objects are keyed by id — deleting by value would otherwise orphan the image.
    const removedId = await deleteTheme(token, themeId);
    if (removedId) {
      deleteImagesForTheme(token, removedId); // fire-and-forget; orphaned images shouldn't fail the delete
    }
    return res.status(200).json({ success: true, themeId, removed: !!removedId });
  } catch (err) {
    console.error('[themeLibraryRoutes] Error deleting theme:', err.message);
    return res.status(500).json({ error: 'Failed to delete theme.' });
  }
});

module.exports = router;
