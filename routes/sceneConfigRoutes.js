// routes/sceneConfigRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const { upsertSceneConfig, getSceneConfig, deleteSceneConfig } = require('../services/sceneConfigService');
const { uploadDataUrlToGCS, deleteImagesForToken } = require('../services/storageService');

const router = express.Router();

// Middleware: Route-scoped body parser up to 1MB (overriding global limit for bgImage data URLs)
const jsonParser = express.json({ limit: '1mb' });

// Middleware: Rate limiting specifically for scene config updates/deletes (30 req / 15 min / IP)
const sceneConfigLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many configuration requests. Please try again later.' }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every key the overlay reads: ConfigManager.getDefaultConfig() plus the runtime-only
// keys written by settings-panel-manager (googleFontFamily, bgImage, channel targets,
// YouTube toggles, preChromaKeyOpacity). Unknown keys are dropped so the endpoint
// can't be used as an arbitrary public JSON store.
const ALLOWED_CONFIG_KEYS = new Set([
  'configVersion', 'chatMode', 'bgColor', 'borderColor', 'textColor', 'usernameColor',
  'fontSize', 'fontFamily', 'fontWeight', 'chatWidth', 'chatHeight', 'maxMessages',
  'showTimestamps', 'overrideUsernameColors', 'borderRadius', 'boxShadow', 'textShadow',
  'popup', 'theme', 'lastChannel', 'showBadges', 'showPronouns', 'timestampColor',
  'pronounBadgeColor', 'badgeEndpointUrlGlobal', 'badgeEndpointUrlChannel',
  'badgeCacheGlobalTTL', 'badgeCacheChannelTTL', 'badgeFallbackHide',
  'cheermoteEndpointUrl', 'cheermoteCacheTTL', 'thirdPartyEmotes',
  'thirdPartyChannelEmotes', 'thirdPartyFilter7tvTwitchDisallowed',
  'thirdPartyFilter7tvSexual', 'thirdPartyFilter7tvEpilepsy', 'thirdPartyFilter7tvEdgy',
  'thirdPartyEmoteCacheGlobalTTL', 'thirdPartyEmoteCacheChannelTTL',
  'enlargeSingleEmotes', 'bgColorOpacity', 'bgImageOpacity', 'topFade', 'chromaKey',
  'googleFontFamily', 'bgImage', 'lastTwitchChannel', 'lastYouTubeTarget',
  'showSuperChats', 'showMembershipEvents', 'showPlatformBadges', 'preChromaKeyOpacity'
]);

const MAX_SCENE_NAME_LENGTH = 200;
const MAX_UPDATED_BY_LENGTH = 100;

function sanitizeConfig(config) {
  const sanitized = {};
  for (const key of Object.keys(config)) {
    if (ALLOWED_CONFIG_KEYS.has(key)) {
      sanitized[key] = config[key];
    }
  }
  return sanitized;
}

function validateToken(req, res, next) {
  const { token } = req.params;
  if (!token || !UUID_REGEX.test(token)) {
    return res.status(400).json({ error: 'Invalid token format. Token must be a valid UUID.' });
  }
  next();
}

// PUT /api/scene-config/:token
router.put('/scene-config/:token', sceneConfigLimiter, jsonParser, validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const body = req.body || {};

    if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) {
      return res.status(400).json({ error: 'Missing or invalid "config" object in payload.' });
    }

    body.config = sanitizeConfig(body.config);

    // Automatically convert base64 bgImage data URLs to Cloud Storage public HTTPS URLs
    if (body.config.bgImage && typeof body.config.bgImage === 'string' && body.config.bgImage.startsWith('data:image/')) {
      const gcsUrl = await uploadDataUrlToGCS(body.config.bgImage, token);
      if (gcsUrl) {
        body.config.bgImage = gcsUrl;
      }
    }

    let stripped = false;
    let payloadString = JSON.stringify(body);
    const MAX_BYTES = 900 * 1024; // 900 KB limit for Firestore doc safety

    if (Buffer.byteLength(payloadString, 'utf8') > MAX_BYTES) {
      // Fallback: strip bgImage data URL if payload still exceeds limit
      if (body.config.bgImage) {
        body.config.bgImage = null;
        stripped = true;
        payloadString = JSON.stringify(body);
      }

      if (Buffer.byteLength(payloadString, 'utf8') > MAX_BYTES) {
        return res.status(413).json({ error: 'Configuration payload exceeds maximum 900 KB limit.' });
      }
    }

    await upsertSceneConfig(token, {
      config: body.config,
      sceneName: typeof body.sceneName === 'string' ? body.sceneName.slice(0, MAX_SCENE_NAME_LENGTH) : 'default',
      configVersion: typeof body.configVersion === 'number' ? body.configVersion : 2,
      updatedBy: typeof body.updatedBy === 'string' ? body.updatedBy.slice(0, MAX_UPDATED_BY_LENGTH) : ''
    });

    return res.status(200).json({
      success: true,
      token,
      stripped
    });
  } catch (err) {
    console.error('Error saving scene config:', err);
    return res.status(500).json({ error: 'Failed to save scene configuration.' });
  }
});

// GET /api/scene-config/:token
router.get('/scene-config/:token', validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    const sceneConfig = await getSceneConfig(token);

    if (!sceneConfig) {
      return res.status(404).json({ error: 'Scene configuration not found.' });
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(sceneConfig);
  } catch (err) {
    console.error('Error retrieving scene config:', err);
    return res.status(500).json({ error: 'Failed to retrieve scene configuration.' });
  }
});

// DELETE /api/scene-config/:token
router.delete('/scene-config/:token', sceneConfigLimiter, validateToken, async (req, res) => {
  try {
    const { token } = req.params;
    await deleteSceneConfig(token);
    deleteImagesForToken(token); // fire-and-forget; orphaned images shouldn't fail the delete
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error('Error deleting scene config:', err);
    return res.status(500).json({ error: 'Failed to delete scene configuration.' });
  }
});

module.exports = router;
