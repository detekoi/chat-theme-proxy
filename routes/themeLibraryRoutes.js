// routes/themeLibraryRoutes.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getLibrary, addTheme, deleteTheme, setActiveTheme } = require('../services/themeLibraryService');
const { uploadDataUrlToGCS, deleteImagesForTheme, copyToThemeBackground, isOwnBucketUrl } = require('../services/storageService');
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
  // Marks a theme the user saved from their own settings rather than one the AI
  // generated, so the carousel can badge it. Without it here, sanitizeTheme drops
  // the flag and the badge disappears on the next sync.
  'isUserPreset',
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
  // Coerce to a real boolean so the stored flag can't be an arbitrary
  // client-supplied payload riding in on a whitelisted key.
  if ('isUserPreset' in sanitized) {
    sanitized.isUserPreset = !!sanitized.isUserPreset;
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
    } else if (isOwnBucketUrl(theme.backgroundImage)) {
      // A saved preset can reference an image it doesn't own — a scene background
      // (overwritten on the next scene save, deleted with the scene) or another
      // theme's background (deleted with that theme). Give this theme its own copy
      // so its image can't be pulled out from under it later.
      const copied = await copyToThemeBackground(theme.backgroundImage, token, themeId);
      if (copied !== undefined) {
        theme.backgroundImage = copied;
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

// PUT /api/theme-library/:token/active-theme
// Lightweight endpoint for cross-page carousel sync: persists which theme is
// currently selected so other browser tabs/pages pick it up via onSnapshot.
router.put('/theme-library/:token/active-theme', tokenLimiter, jsonParser, validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const { themeValue, updatedBy } = req.body || {};

    if (!themeValue || typeof themeValue !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "themeValue" string in payload.' });
    }

    await setActiveTheme(token, themeValue, updatedBy || null);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[themeLibraryRoutes] Error setting active theme:', err.message);
    return res.status(500).json({ error: 'Failed to set active theme.' });
  }
});

module.exports = router;
