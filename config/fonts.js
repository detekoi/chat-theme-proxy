// config/fonts.js

// Define available fonts - Initial state with custom fonts
const initialFonts = [
  // Custom fonts (Always preserved)
  { name: 'Atkinson Hyperlegible', value: "'Atkinson Hyperlegible', sans-serif", description: 'Designed for high legibility and reading clarity, especially at small sizes.', custom: true },
  { name: 'Tektur', value: "'Tektur', sans-serif", description: 'Modern and slightly angular typeface with a technical/sci-fi aesthetic.', custom: true },
  { name: 'MedievalSharp', value: "'MedievalSharp', cursive", description: 'Evokes a medieval/fantasy atmosphere with calligraphic details.', custom: true },
  { name: 'Press Start 2P', value: "'Press Start 2P', cursive", description: 'Pixelated retro gaming font that resembles 8-bit text.', custom: true },
  { name: 'Jacquard', value: "'Jacquard', monospace", description: 'Pixelated font with retro fantasy vibes based on Victorian needlepoint.', custom: true },

  // System fonts organized by categories
  // Sans-serif fonts
  { name: 'System UI', value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { name: 'Arial', value: "Arial, sans-serif", description: 'Classic sans-serif font with good readability.' },
  { name: 'Helvetica', value: "Helvetica, Arial, sans-serif", description: 'Clean modern sans-serif font widely used in design.' },
  { name: 'Verdana', value: "Verdana, Geneva, sans-serif", description: 'Sans-serif designed for good readability on screens.' },
  { name: 'Tahoma', value: "Tahoma, Geneva, sans-serif", description: 'Compact sans-serif with good readability at small sizes.' },
  { name: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif", description: 'Humanist sans-serif with distinctive character shapes.' },
  { name: 'Calibri', value: "Calibri, sans-serif", description: 'Modern sans-serif with rounded details and good readability.' },

  // Serif fonts
  { name: 'Times New Roman', value: "'Times New Roman', Times, serif", description: 'Classic serif font with traditional letterforms.' },
  { name: 'Georgia', value: "Georgia, serif", description: 'Elegant serif font designed for screen readability.' },
  { name: 'Palatino', value: "'Palatino Linotype', 'Book Antiqua', Palatino, serif", description: 'Elegant serif based on Renaissance letterforms.' },
  { name: 'EB Garamond', value: "'EB Garamond', Garamond, Baskerville, 'Baskerville Old Face', serif", description: 'Classical serif with elegant proportions.', custom: true },

  // Monospace fonts
  { name: 'Courier New', value: "'Courier New', Courier, monospace", description: 'Classic monospaced font resembling typewriter text.' },
  { name: 'Consolas', value: "'Consolas', monaco, monospace", description: 'Modern monospaced font designed for coding.' },
  { name: 'Lucida Console', value: "'Lucida Console', Monaco, monospace", description: 'Clear monospace font with good readability.' },

  // Display/Decorative fonts that are commonly available
  { name: 'Impact', value: "'Impact', Haettenschweiler, sans-serif", description: 'Bold condensed sans-serif font, often used for headlines.' },
  { name: 'Comic Sans MS', value: "'Comic Sans MS', cursive", description: 'Casual script-like font with a friendly appearance.' },
  { name: 'Arial Black', value: "'Arial Black', Gadget, sans-serif", description: 'Extra bold version of Arial for strong emphasis.' }
];

module.exports = {
  initialFonts
};
