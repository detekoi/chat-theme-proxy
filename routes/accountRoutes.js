// routes/accountRoutes.js
const express = require('express');
const { createTokenLimiter, validateToken } = require('../middleware/tokenValidation');
const { sanitizeSceneName } = require('../utils/accountRegistry');

const MAX_SCENES_PER_REQUEST = 100;
const MAX_ORDER_LENGTH = 100;

// Middleware: Route-scoped body parser (account payloads are small).
const jsonParser = express.json();

function createAccountRouter({
  accountService = require('../services/accountService'),
  requireTwitchUser = require('../middleware/twitchAuth').requireTwitchUser
} = {}) {
  const router = express.Router();

  // Own limiter instance, separate from the scene-config and theme-library
  // budgets so account management doesn't starve or get starved by those.
  const accountLimiter = createTokenLimiter({ max: 120 });

  // GET /api/account
  router.get('/account', accountLimiter, requireTwitchUser, async (req, res) => {
    try {
      const { id, login } = req.twitchUser;
      const { scenes, sceneOrder } = await accountService.getAccount(id);
      return res.status(200).json({ user: { id, login }, scenes, sceneOrder });
    } catch (err) {
      console.error('[accountRoutes] Error retrieving account:', err.message);
      return res.status(500).json({ error: 'Failed to retrieve account.' });
    }
  });

  // POST /api/account/scenes
  router.post('/account/scenes', accountLimiter, requireTwitchUser, jsonParser, async (req, res) => {
    try {
      const body = req.body || {};
      const { scenes } = body;

      if (!Array.isArray(scenes) || scenes.length === 0 || scenes.length > MAX_SCENES_PER_REQUEST) {
        return res.status(400).json({ error: 'Missing or invalid "scenes" array in payload.' });
      }

      const incoming = [];
      for (const entry of scenes) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          return res.status(400).json({ error: 'Each scene entry must be an object with a "token" field.' });
        }
        if (typeof entry.token !== 'string') {
          return res.status(400).json({ error: 'Each scene entry must have a string "token" field.' });
        }
        incoming.push({ token: entry.token.toLowerCase(), name: sanitizeSceneName(entry.name) });
      }

      const force = body.force === true;
      const { id, login } = req.twitchUser;

      const result = await accountService.linkScenes(id, login, incoming, { force });

      return res.status(200).json({
        success: true,
        linked: result.linked,
        skipped: result.skipped,
        existing: result.existing,
        rejected: result.rejected,
        sceneOrder: result.sceneOrder
      });
    } catch (err) {
      console.error('[accountRoutes] Error linking scenes:', err.message);
      return res.status(500).json({ error: 'Failed to link scenes.' });
    }
  });

  // DELETE /api/account/scenes/:token
  router.delete('/account/scenes/:token', accountLimiter, requireTwitchUser, validateToken, async (req, res) => {
    try {
      const token = req.params.token.toLowerCase();
      const { id } = req.twitchUser;

      const { removed } = await accountService.unlinkScene(id, token);

      return res.status(200).json({ success: true, token, removed });
    } catch (err) {
      console.error('[accountRoutes] Error unlinking scene:', err.message);
      return res.status(500).json({ error: 'Failed to unlink scene.' });
    }
  });

  // PUT /api/account/scene-order
  router.put('/account/scene-order', accountLimiter, requireTwitchUser, jsonParser, async (req, res) => {
    try {
      const body = req.body || {};
      const { sceneOrder } = body;

      if (!Array.isArray(sceneOrder) || sceneOrder.length > MAX_ORDER_LENGTH) {
        return res.status(400).json({ error: 'Missing or invalid "sceneOrder" array in payload.' });
      }

      const { id } = req.twitchUser;
      const result = await accountService.setSceneOrder(id, sceneOrder);

      return res.status(200).json({ success: true, sceneOrder: result.sceneOrder });
    } catch (err) {
      console.error('[accountRoutes] Error setting scene order:', err.message);
      return res.status(500).json({ error: 'Failed to set scene order.' });
    }
  });

  return router;
}

module.exports = createAccountRouter();
module.exports.createAccountRouter = createAccountRouter;
