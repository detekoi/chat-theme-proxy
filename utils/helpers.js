// utils/helpers.js
const { borderRadiusPresets, boxShadowPresets } = require('../config/presets');

/**
 * Get CSS value from border radius preset name
 * @param {string} preset - Border radius preset name
 * @returns {string} - CSS border radius value
 */
const getBorderRadiusValue = (preset) => borderRadiusPresets[preset] || borderRadiusPresets["None"];

/**
 * Get CSS value from box shadow preset name
 * @param {string} preset - Box shadow preset name
 * @returns {string} - CSS box shadow value
 */
const getBoxShadowValue = (preset) => boxShadowPresets[preset] || boxShadowPresets["None"];

/**
 * Generate a unique storage key for generated themes
 * @param {string} themeId - Theme ID
 * @returns {string} - Storage key
 */
const generateThemeStorageKey = (themeId) => `generated-theme-image-${themeId}`;

module.exports = {
  getBorderRadiusValue,
  getBoxShadowValue,
  generateThemeStorageKey
};
