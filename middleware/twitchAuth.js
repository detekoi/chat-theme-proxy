// middleware/twitchAuth.js
const axios = require('axios');
const crypto = require('crypto');

const VALIDATE_URL = 'https://id.twitch.tv/oauth2/validate';

const AUTH_HEADER_REGEX = /^(Bearer|OAuth)[ \t]+(\S+)$/i;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Builds Express middleware that authenticates a request via a Twitch user
 * access token, validating it against Twitch's /oauth2/validate endpoint and
 * caching successful validations in-memory.
 *
 * @param {Object} [options]
 * @param {Object} [options.httpClient=axios] - axios-compatible client (must expose .get)
 * @param {string} [options.clientId=process.env.TWITCH_CLIENT_ID]
 * @param {Function} [options.now=Date.now]
 * @param {number} [options.cacheTtlMs=300000]
 * @param {number} [options.maxCacheEntries=1000]
 * @param {Object} [options.logger=console]
 * @returns {Function} async (req, res, next) => void
 */
function createRequireTwitchUser({
  httpClient = axios,
  clientId = process.env.TWITCH_CLIENT_ID,
  now = Date.now,
  cacheTtlMs = 5 * 60 * 1000,
  maxCacheEntries = 1000,
  logger = console
} = {}) {
  const cache = new Map();
  let warnedMissingClientId = false;

  const middleware = async function requireTwitchUser(req, res, next) {
    const authHeader = req.headers && req.headers.authorization;
    const match = typeof authHeader === 'string' ? authHeader.match(AUTH_HEADER_REGEX) : null;

    if (!match) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    }

    if (!clientId) {
      if (!warnedMissingClientId) {
        warnedMissingClientId = true;
        logger.warn('twitchAuth: TWITCH_CLIENT_ID is not configured; rejecting account requests.');
      }
      return res.status(503).json({ error: 'Account features are not configured.' });
    }

    const token = match[2];
    const cacheKey = hashToken(token);
    const nowMs = now();

    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > nowMs) {
      req.twitchUser = { id: cached.id, login: cached.login };
      return next();
    }

    let response;
    try {
      response = await httpClient.get(VALIDATE_URL, {
        headers: { Authorization: `OAuth ${token}` },
        timeout: 5000,
        validateStatus: () => true
      });
    } catch (err) {
      logger.warn(`twitchAuth: validation request failed for token ${cacheKey.slice(0, 8)}...`);
      return res.status(503).json({ error: 'Could not verify Twitch login. Try again.' });
    }

    const { status, data } = response || {};

    // An app access token (client-credentials) for this same client id also
    // validates 200, but carries no user_id/login; it must not become a user.
    if (status === 200 && data && data.client_id === clientId && data.user_id) {
      const expiresInMs = (data.expires_in || 0) * 1000;
      const ttl = Math.min(cacheTtlMs, expiresInMs || cacheTtlMs);

      if (cache.size >= maxCacheEntries && !cache.has(cacheKey)) {
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }
      cache.set(cacheKey, {
        id: String(data.user_id),
        login: data.login,
        expiresAt: nowMs + ttl
      });

      req.twitchUser = { id: String(data.user_id), login: data.login };
      return next();
    }

    if (status === 200 && data && data.client_id === clientId) {
      return res.status(401).json({ error: 'Token is not a Twitch user token.' });
    }

    if (status === 200) {
      return res.status(401).json({ error: 'Token was not issued to this application.' });
    }

    if (status === 401) {
      return res.status(401).json({ error: 'Invalid or expired Twitch token.' });
    }

    return res.status(503).json({ error: 'Could not verify Twitch login. Try again.' });
  };

  middleware.cache = cache;

  return middleware;
}

const requireTwitchUser = createRequireTwitchUser();

function _resetCache() {
  requireTwitchUser.cache.clear();
}

module.exports = {
  createRequireTwitchUser,
  requireTwitchUser,
  _resetCache,
  VALIDATE_URL
};
