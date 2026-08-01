// services/storageService.js
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'chat-themer-backgrounds';

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

module.exports = {
  uploadDataUrlToGCS,
  deleteImagesForToken,
  deleteImagesForTheme
};
