// utils/configValidation.js
const { sanitizeImageUrl } = require('./imageValidation');

// Keys the overlay used to read its badge and cheermote endpoints from. The
// overlay now uses fixed endpoints, and a scene token is the only credential for
// writing a scene config, so these must never be stored: a token holder could
// otherwise point older overlay builds at their own server, whose image URLs
// would then be loaded inside OBS. Saves delete any stored copies
// (sceneConfigService) and reads strip them.
const REMOVED_CONFIG_KEYS = Object.freeze([
  'badgeEndpointUrlGlobal',
  'badgeEndpointUrlChannel',
  'cheermoteEndpointUrl'
]);

/**
 * Constrain the values of a key-sanitized scene config that decide what the
 * overlay loads: removed endpoint keys are dropped and bgImage is limited to
 * image data URLs or our own bucket. Mutates and returns `config`.
 *
 * @param {Object} config
 * @returns {Object}
 */
function sanitizeSceneConfigValues(config) {
  for (const key of REMOVED_CONFIG_KEYS) {
    delete config[key];
  }
  if ('bgImage' in config) {
    config.bgImage = sanitizeImageUrl(config.bgImage);
  }
  return config;
}

module.exports = {
  REMOVED_CONFIG_KEYS,
  sanitizeSceneConfigValues
};
