// config/presets.js

// Define border radius presets
const borderRadiusPresets = {
  "None": "0px",
  "Subtle": "8px",
  "Rounded": "16px",
  "Pill": "24px"
};

// Define box shadow presets
const boxShadowPresets = {
  "None": "none",
  "Soft": "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  "Simple 3D": "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px",
  "Intense 3D": "rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px",
  "Sharp": "8px 8px 0px 0px rgba(0, 0, 0, 0.9)"
};

module.exports = {
  borderRadiusPresets,
  boxShadowPresets
};
