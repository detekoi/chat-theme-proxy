// utils/configValidation.js
const { sanitizeImageUrl } = require('./imageValidation');

// The overlay fetches badge and cheermote JSON from these URLs and loads every
// image URL in the response inside OBS. A scene token is the only credential for
// writing a scene config, so a token holder must not be able to point a streamer's
// overlay at their own server: these keys are always stored as our own endpoints.
const PINNED_ENDPOINTS = {
  badgeEndpointUrlGlobal: 'https://us-central1-chat-themer.cloudfunctions.net/getGlobalBadges',
  badgeEndpointUrlChannel: 'https://us-central1-chat-themer.cloudfunctions.net/getChannelBadges',
  cheermoteEndpointUrl: 'https://us-central1-chat-themer.cloudfunctions.net/getCheermotes'
};

/**
 * Constrain the values of a key-sanitized scene config that decide what the
 * overlay loads: endpoint URLs are pinned and bgImage is limited to image data
 * URLs or our own bucket. Mutates and returns `config`.
 *
 * Endpoints are written even when the client omitted them: the Firestore write
 * merges into the stored config, so leaving a key out would keep whatever value
 * an earlier write put there.
 *
 * @param {Object} config
 * @returns {Object}
 */
function sanitizeSceneConfigValues(config) {
  Object.assign(config, PINNED_ENDPOINTS);
  if ('bgImage' in config) {
    config.bgImage = sanitizeImageUrl(config.bgImage);
  }
  return config;
}

module.exports = {
  PINNED_ENDPOINTS,
  sanitizeSceneConfigValues
};
