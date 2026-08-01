// middleware/tokenValidation.js
const rateLimit = require('express-rate-limit');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds a rate limiter for token-scoped write/delete endpoints.
 *
 * Each router must call this to get its OWN limiter: express-rate-limit keeps a
 * per-instance counter store, so mounting a single shared instance on several
 * routers would make them consume one combined budget. Theme additions and scene
 * saves are independent user actions and must not starve each other.
 *
 * @param {Object} [options]
 * @param {number} [options.max=30] - Max requests per window per IP.
 * @param {number} [options.windowMs=900000] - Window length in ms.
 * @returns {Function} Express middleware.
 */
function createTokenLimiter({ max = 30, windowMs = 15 * 60 * 1000 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many configuration requests. Please try again later.' }
  });
}

/**
 * Express middleware that validates req.params.token is a well-formed UUID.
 * Responds with 400 and does not call next() if the token is missing or invalid.
 */
function validateToken(req, res, next) {
  const { token } = req.params;
  if (!token || !UUID_REGEX.test(token)) {
    return res.status(400).json({ error: 'Invalid token format. Token must be a valid UUID.' });
  }
  next();
}

module.exports = {
  UUID_REGEX,
  createTokenLimiter,
  validateToken
};
