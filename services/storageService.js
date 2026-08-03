// services/storageService.js
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chat-themer-backgrounds';
const PUBLIC_URL_PREFIX = `https://storage.googleapis.com/${BUCKET_NAME}/`;

/**
 * True when `url` points at an object in our own bucket.
 * @param {string} url
 * @returns {boolean}
 */
function isOwnBucketUrl(url) {
  return typeof url === 'string' && url.startsWith(PUBLIC_URL_PREFIX);
}

/**
 * Extract the object path from one of our own public GCS URLs.
 * @param {string} url
 * @returns {string|null} The object path, or null if the URL isn't ours/is unsafe.
 */
function gcsObjectPathFromUrl(url) {
  if (!isOwnBucketUrl(url)) return null;
  try {
    const rawPath = url.slice(PUBLIC_URL_PREFIX.length).split('?')[0];
    const path = decodeURIComponent(rawPath);
    return (!path || path.includes('..')) ? null : path;
  } catch (err) {
    return null;
  }
}

/**
 * Uploads a base64 data URL to Google Cloud Storage and returns its public HTTPS URL.
 * @param {string} dataUrl - The data URL string (e.g. data:image/png;base64,...)
 * @param {string} filename - The destination filename (e.g. token.png)
 * @param {string} [destinationPrefix='backgrounds/'] - The GCS path prefix to upload under.
 * @returns {Promise<string|null>} The public GCS URL or null if upload fails
 */
async function uploadDataUrlToGCS(dataUrl, filename, destinationPrefix = 'backgrounds/') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return null;
  }

  try {
    const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9+\-+.]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      console.warn('[storageService] Invalid data URL format.');
      return null;
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const MIME_EXTENSION_MAP = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };

    const extension = MIME_EXTENSION_MAP[contentType] || contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
    const destinationPath = `${destinationPrefix}${filename.includes('.') ? filename : `${filename}.${extension}`}`;

    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(destinationPath);

    await file.save(buffer, {
      metadata: {
        contentType: contentType,
        cacheControl: 'public, max-age=31536000'
      },
      resumable: false
    });

    // Make file publicly readable if bucket supports legacy ACLs
    try {
      await file.makePublic();
    } catch (aclErr) {
      // Uniform bucket-level access enabled on GCS bucket
      console.log('[storageService] Note: Bucket uses uniform access policy.');
    }

    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destinationPath}`;
    console.log(`[storageService] Successfully uploaded background image to GCS: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error('[storageService] Failed to upload image to GCS:', err.message);
    return null;
  }
}

/**
 * Deletes any background images previously uploaded for a scene token.
 * Tokens are fixed-length UUIDs, so the "backgrounds/<token>." prefix cannot
 * match another token's files.
 * @param {string} token - The scene token whose images should be removed.
 * @returns {Promise<void>}
 */
async function deleteImagesForToken(token) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: `backgrounds/${token}.` });
    await Promise.all(files.map(file => file.delete().catch(() => {})));
    if (files.length > 0) {
      console.log(`[storageService] Deleted ${files.length} background image(s) for token ${token}`);
    }
  } catch (err) {
    console.warn('[storageService] Failed to delete background images:', err.message);
  }
}

/**
 * Deletes any background images previously uploaded for a theme in a user's theme library.
 * Library tokens are fixed-length UUIDs and theme IDs are UUIDs, so the
 * "theme-backgrounds/<libraryToken>/<themeId>." prefix cannot match another theme's files.
 * @param {string} libraryToken - The theme library token whose theme image should be removed.
 * @param {string} themeId - The theme ID whose images should be removed.
 * @returns {Promise<void>}
 */
async function deleteImagesForTheme(libraryToken, themeId) {
  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: `theme-backgrounds/${libraryToken}/${themeId}.` });
    await Promise.all(files.map(file => file.delete().catch(() => {})));
    if (files.length > 0) {
      console.log(`[storageService] Deleted ${files.length} theme background image(s) for theme ${themeId}`);
    }
  } catch (err) {
    console.warn('[storageService] Failed to delete theme background images:', err.message);
  }
}

/**
 * Copy an existing image in our bucket into a theme's own canonical location.
 *
 * A saved preset can arrive carrying an image URL it does not own:
 *   - a SCENE background (`backgrounds/<syncToken>.<ext>`), which is overwritten on
 *     every scene save and deleted with the scene, or
 *   - ANOTHER THEME's background (`theme-backgrounds/<token>/<otherId>.<ext>`),
 *     which is deleted when that theme is deleted.
 * Storing either URL as-is makes this theme's image silently vanish later, so the
 * object is copied and the theme gets its own.
 *
 * The three return shapes are load-bearing:
 *   undefined -> not our object; leave the caller's value untouched
 *   null      -> source is definitively gone; store no image
 *   string    -> the canonical URL (possibly unchanged, if already canonical)
 * Distinguishing "missing" from "copy failed" keeps a transient GCS error from
 * destroying a URL that still works.
 *
 * @param {string} sourceUrl - Current image URL.
 * @param {string} libraryToken - Theme library token (owning namespace).
 * @param {string} themeId - Server-assigned theme id.
 * @returns {Promise<string|null|undefined>}
 */
async function copyToThemeBackground(sourceUrl, libraryToken, themeId) {
  const srcPath = gcsObjectPathFromUrl(sourceUrl);
  if (!srcPath) return undefined;

  const extension = (srcPath.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
  const destinationPath = `theme-backgrounds/${libraryToken}/${themeId}.${extension}`;

  // Already canonical: a re-POST of an existing theme must not self-copy.
  if (destinationPath === srcPath) return sourceUrl;

  try {
    const bucket = storage.bucket(BUCKET_NAME);
    const sourceFile = bucket.file(srcPath);

    const [exists] = await sourceFile.exists();
    if (!exists) {
      console.warn(`[storageService] Source image no longer exists, dropping reference: ${srcPath}`);
      return null;
    }

    await sourceFile.copy(bucket.file(destinationPath));

    try {
      await bucket.file(destinationPath).makePublic();
    } catch (aclErr) {
      console.log('[storageService] Note: Bucket uses uniform access policy.');
    }

    const publicUrl = `${PUBLIC_URL_PREFIX}${destinationPath}`;
    console.log(`[storageService] Copied theme background ${srcPath} -> ${destinationPath}`);
    return publicUrl;
  } catch (err) {
    // Keep the working (if shared) URL rather than wiping the user's image.
    console.error('[storageService] Failed to copy theme background:', err.message);
    return sourceUrl;
  }
}

module.exports = {
  uploadDataUrlToGCS,
  deleteImagesForToken,
  deleteImagesForTheme,
  copyToThemeBackground,
  isOwnBucketUrl
};
