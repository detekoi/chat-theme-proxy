// utils/imageValidation.js
//
// Background images end up in the overlay's CSS (`url("<value>")`) inside an OBS
// Browser Source, so the only values stored are ones the proxy itself vouches for:
// raster image data URLs whose bytes match their type, or objects in our own bucket.

const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chat-themer-backgrounds';
const PUBLIC_URL_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`;

// Content type -> file extension. SVG is deliberately absent: opened directly from
// the public bucket it runs script.
const ALLOWED_IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp'
};

const DATA_URL_REGEX = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/;

// Object paths we write are UUIDs plus an extension, under backgrounds/ or
// theme-backgrounds/<token>/. No '%', quotes or backslashes, so a value can't
// be decoded into another path or break out of the CSS string it lands in.
const OBJECT_PATH_REGEX = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

/**
 * Identify an image from its leading bytes.
 * @param {Buffer} buffer
 * @returns {string|null} An ALLOWED_IMAGE_TYPES key, or null if unrecognised.
 */
function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  const head = buffer.subarray(0, 6).toString('latin1');
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Parse a base64 image data URL, accepting only PNG, JPEG, GIF and WebP whose
 * bytes match an allowed type. The returned contentType comes from the bytes,
 * not the declared type.
 * @param {string} dataUrl
 * @returns {{contentType: string, extension: string, buffer: Buffer}|null}
 */
function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const matches = dataUrl.match(DATA_URL_REGEX);
  if (!matches) return null;

  const declaredType = matches[1] === 'image/jpg' ? 'image/jpeg' : matches[1];
  if (!ALLOWED_IMAGE_TYPES[declaredType]) return null;

  const buffer = Buffer.from(matches[2], 'base64');
  const contentType = sniffImageType(buffer);
  if (!contentType) return null;

  return { contentType, extension: ALLOWED_IMAGE_TYPES[contentType], buffer };
}

/**
 * Extract the object path from one of our own public GCS URLs.
 * The URL must already be in canonical form, so `..` segments, percent-encoding,
 * query strings and fragments are all rejected rather than normalised.
 * @param {string} url
 * @returns {string|null} The object path, or null if the URL isn't ours.
 */
function ownBucketObjectPath(url) {
  if (typeof url !== 'string' || !url.startsWith(PUBLIC_URL_PREFIX)) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    return null;
  }
  if (parsed.href !== url) return null;

  const path = url.slice(PUBLIC_URL_PREFIX.length);
  return OBJECT_PATH_REGEX.test(path) ? path : null;
}

/**
 * True when `url` points at an object in our own bucket.
 * @param {string} url
 * @returns {boolean}
 */
function isOwnBucketUrl(url) {
  return ownBucketObjectPath(url) !== null;
}

/**
 * Sanitize a stored background image value (scene `bgImage` or theme `backgroundImage`).
 * Keeps "no image" values (null, '', 'none'), valid image data URLs and our own
 * bucket URLs. Anything else — including any other external URL — becomes null.
 * @param {*} value
 * @returns {string|null}
 */
function sanitizeImageUrl(value) {
  if (value === null || value === undefined || value === '' || value === 'none') return value ?? null;
  if (typeof value !== 'string') return null;
  if (value.startsWith('data:')) return parseImageDataUrl(value) ? value : null;
  return isOwnBucketUrl(value) ? value : null;
}

module.exports = {
  BUCKET_NAME,
  PUBLIC_URL_PREFIX,
  ALLOWED_IMAGE_TYPES,
  sniffImageType,
  parseImageDataUrl,
  ownBucketObjectPath,
  isOwnBucketUrl,
  sanitizeImageUrl
};
