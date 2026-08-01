// services/sceneConfigService.js
const { Firestore, Timestamp, FieldValue } = require('@google-cloud/firestore');

const firestore = new Firestore();
const COLLECTION_NAME = 'sceneConfigs';
const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Upserts a scene configuration in Firestore.
 * @param {string} token - The unique scene token (UUID).
 * @param {Object} data - Containing { config, sceneName, configVersion, updatedBy }
 * @returns {Promise<Object>} The saved status
 */
async function upsertSceneConfig(token, data) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);
  const docSnap = await docRef.get();

  const expiresAt = Timestamp.fromMillis(Date.now() + TWELVE_MONTHS_MS);
  
  const payload = {
    config: data.config,
    sceneName: data.sceneName || 'default',
    configVersion: data.configVersion || 2,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: data.updatedBy || '',
    expiresAt: expiresAt
  };

  if (!docSnap.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await docRef.set(payload, { merge: true });
  return { success: true, token };
}

/**
 * Gets a scene configuration from Firestore.
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
async function getSceneConfig(token) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return null;
  }

  const data = docSnap.data();
  return {
    config: data.config,
    sceneName: data.sceneName,
    configVersion: data.configVersion,
    updatedBy: data.updatedBy || '',
    createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
    expiresAt: data.expiresAt ? data.expiresAt.toDate().toISOString() : null
  };
}

/**
 * Deletes a scene configuration from Firestore.
 * @param {string} token
 * @returns {Promise<boolean>}
 */
async function deleteSceneConfig(token) {
  const docRef = firestore.collection(COLLECTION_NAME).doc(token);
  await docRef.delete();
  return true;
}

module.exports = {
  upsertSceneConfig,
  getSceneConfig,
  deleteSceneConfig
};
