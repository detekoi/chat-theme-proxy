// services/themeLibraryService.js
const { Firestore, Timestamp, FieldValue } = require('@google-cloud/firestore');

const firestore = new Firestore();
const COLLECTION_NAME = 'themeLibraries';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

// Maximum number of themes retained per library. Oldest themes are trimmed
// once this cap is exceeded (list is stored newest first).
const MAX_LIBRARY_THEMES = 50;

/**
 * Gets a user's theme library from Firestore.
 * @param {string} token - The theme library token (UUID).
 * @returns {Promise<Object>} { themes, createdAt, updatedAt, expiresAt } - themes is [] when the doc does not exist.
 */
async function getLibrary(token) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return {
      themes: [],
      createdAt: null,
      updatedAt: null,
      expiresAt: null
    };
  }

  const data = docSnap.data();
  return {
    themes: Array.isArray(data.themes) ? data.themes : [],
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
    expiresAt: data.expiresAt ? data.expiresAt.toDate().toISOString() : null
  };
}

/**
 * Adds a theme to a user's theme library, prepending it (newest first), deduping
 * by theme.value, and trimming to MAX_LIBRARY_THEMES. Runs as a Firestore transaction
 * so concurrent browser tabs generating themes can't clobber each other's writes.
 * @param {string} token - The theme library token (UUID).
 * @param {Object} theme - The sanitized theme object to add. Must include a `value` and `id`.
 * @returns {Promise<Object>} The stored theme.
 */
async function addTheme(token, theme) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);

  await firestore.runTransaction(async (tx) => {
    const docSnap = await tx.get(docRef);
    const expiresAt = Timestamp.fromMillis(Date.now() + TWELVE_MONTHS_MS);

    let themes = [];
    let isNewDoc = true;

    if (docSnap.exists) {
      isNewDoc = false;
      const data = docSnap.data();
      themes = Array.isArray(data.themes) ? data.themes : [];
    }

    // Dedupe by theme.value: drop any existing entry that matches before prepending.
    themes = themes.filter(existing => existing.value !== theme.value);
    themes.unshift(theme);

    // Trim to cap, keeping the newest entries.
    if (themes.length > MAX_LIBRARY_THEMES) {
      themes = themes.slice(0, MAX_LIBRARY_THEMES);
    }

    const payload = {
      themes,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt
    };

    if (isNewDoc) {
      payload.createdAt = FieldValue.serverTimestamp();
    }

    tx.set(docRef, payload, { merge: true });
  });

  return theme;
}

/**
 * Deletes a single theme from a user's theme library.
 *
 * Matches on `id` or `value`: a theme added while the client was offline never
 * received a server-assigned id, so the client falls back to sending the theme's
 * `value`. Returns the removed theme's real id so the caller can clean up the
 * right GCS object, which is keyed by id rather than value.
 *
 * @param {string} token - The theme library token (UUID).
 * @param {string} themeId - The id (or value) of the theme to remove.
 * @returns {Promise<string|null>} The removed theme's id, or null if nothing matched.
 */
async function deleteTheme(token, themeId) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);
  let removedId = null;

  await firestore.runTransaction(async (tx) => {
    const docSnap = await tx.get(docRef);
    if (!docSnap.exists) {
      return;
    }

    const data = docSnap.data();
    const themes = Array.isArray(data.themes) ? data.themes : [];
    const match = themes.find(existing => existing.id === themeId || existing.value === themeId);

    if (!match) {
      return;
    }

    const nextThemes = themes.filter(existing => existing !== match);
    removedId = match.id || null;

    tx.set(docRef, {
      themes: nextThemes,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  return removedId;
}

module.exports = {
  getLibrary,
  addTheme,
  deleteTheme,
  MAX_LIBRARY_THEMES
};
