// services/accountService.js
const { Firestore, FieldValue } = require('@google-cloud/firestore');
const { emptyState, applyLink, applyUnlink, normalizeSceneOrder } = require('../utils/accountRegistry');

const ACCOUNTS_COLLECTION = 'accounts';
const SCENE_CONFIGS_COLLECTION = 'sceneConfigs';
const GETALL_CHUNK_SIZE = 100;

/**
 * Splits an array into chunks of at most `size` entries.
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Firestore normally hands back a Timestamp, but tolerate a Date, number or
 * ISO string (seeded data, tests) instead of throwing on `.toDate()`.
 * @param {*} value
 * @returns {string|null}
 */
function toIsoString(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Builds a registry state object ({ scenes, sceneOrder, removed }) from a
 * possibly-missing Firestore account doc snapshot.
 * @param {FirebaseFirestore.DocumentSnapshot} docSnap
 * @returns {{ state: Object, login: string|null, createdAt: * }}
 */
function stateFromSnapshot(docSnap) {
  if (!docSnap.exists) {
    return { state: emptyState(), login: null, createdAt: undefined };
  }
  const data = docSnap.data() || {};
  return {
    state: {
      scenes: (data.scenes && typeof data.scenes === 'object') ? data.scenes : {},
      sceneOrder: Array.isArray(data.sceneOrder) ? data.sceneOrder : [],
      removed: (data.removed && typeof data.removed === 'object') ? data.removed : {}
    },
    login: typeof data.login === 'string' ? data.login : null,
    createdAt: data.createdAt
  };
}

/**
 * Creates an account service instance backed by Firestore.
 * @param {Object} [options]
 * @param {FirebaseFirestore.Firestore} [options.firestore]
 * @param {Function} [options.now] - returns current time in ms
 */
function createAccountService({ firestore = new Firestore(), now = Date.now } = {}) {
  const accountsCollection = firestore.collection(ACCOUNTS_COLLECTION);
  const sceneConfigsCollection = firestore.collection(SCENE_CONFIGS_COLLECTION);

  /**
   * Gets a user's linked scenes, repairing sceneOrder against the stored
   * scenes map, and hydrating each scene with its live sceneConfigs data.
   * @param {string} userId
   * @returns {Promise<{ scenes: Array, sceneOrder: string[] }>}
   */
  async function getAccount(userId) {
    const docRef = accountsCollection.doc(userId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { scenes: [], sceneOrder: [] };
    }

    const data = docSnap.data() || {};
    const scenesMap = (data.scenes && typeof data.scenes === 'object') ? data.scenes : {};
    const storedOrder = Array.isArray(data.sceneOrder) ? data.sceneOrder : [];

    // Repair: keep only tokens present in scenes, then append any scenes
    // missing from the stored order.
    const orderSeen = new Set();
    const sceneOrder = [];
    for (const token of storedOrder) {
      if (typeof token !== 'string') continue;
      if (orderSeen.has(token)) continue;
      if (!scenesMap[token]) continue;
      orderSeen.add(token);
      sceneOrder.push(token);
    }
    for (const token of Object.keys(scenesMap)) {
      if (!orderSeen.has(token)) {
        orderSeen.add(token);
        sceneOrder.push(token);
      }
    }

    if (sceneOrder.length === 0) {
      return { scenes: [], sceneOrder: [] };
    }

    const docRefs = sceneOrder.map((token) => sceneConfigsCollection.doc(token));
    const snapshotsByToken = new Map();
    for (const batch of chunk(docRefs, GETALL_CHUNK_SIZE)) {
      const snaps = await firestore.getAll(...batch);
      for (const snap of snaps) {
        snapshotsByToken.set(snap.id, snap);
      }
    }

    const scenes = sceneOrder.map((token) => {
      const snap = snapshotsByToken.get(token);
      const exists = Boolean(snap && snap.exists);
      const registryEntry = scenesMap[token] || {};
      const sceneData = exists ? (snap.data() || {}) : null;

      // The registry name wins: the OBS overlay writes its `?scene=` id (e.g.
      // "scene_<uuid>") into sceneConfigs.sceneName on every push, so the live
      // doc's name is only trustworthy as a fallback when it isn't id-shaped.
      const liveName = exists && typeof sceneData.sceneName === 'string' ? sceneData.sceneName.trim() : '';
      const liveNameUsable = liveName && !/^scene[_-]/i.test(liveName) && liveName !== 'default';
      const name = registryEntry.name || (liveNameUsable ? liveName : '') || 'Untitled Scene';

      const updatedAt = exists ? toIsoString(sceneData.updatedAt) : null;

      let config = exists ? (sceneData.config || null) : null;
      if (config && typeof config.bgImage === 'string' && config.bgImage.startsWith('data:')) {
        config = { ...config, bgImage: null };
      }

      return { token, name, exists, updatedAt, config };
    });

    return { scenes, sceneOrder };
  }

  /**
   * Links one or more scene tokens into a user's account, creating the
   * account doc on first use.
   * @param {string} userId
   * @param {string} login
   * @param {Array<{token: string, name: string}>} incoming
   * @param {Object} [options]
   * @param {boolean} [options.force=false]
   */
  async function linkScenes(userId, login, incoming, { force = false } = {}) {
    const docRef = accountsCollection.doc(userId);

    let result;
    await firestore.runTransaction(async (tx) => {
      const docSnap = await tx.get(docRef);
      const { state, createdAt } = stateFromSnapshot(docSnap);
      const isNew = !docSnap.exists;

      result = applyLink(state, incoming, { force, now: now() });

      const payload = {
        login,
        scenes: result.state.scenes,
        sceneOrder: result.state.sceneOrder,
        removed: result.state.removed,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (isNew) {
        payload.createdAt = FieldValue.serverTimestamp();
      } else if (createdAt !== undefined) {
        payload.createdAt = createdAt;
      }

      tx.set(docRef, payload);
    });

    return {
      linked: result.linked,
      skipped: result.skipped,
      existing: result.existing,
      rejected: result.rejected,
      sceneOrder: result.state.sceneOrder
    };
  }

  /**
   * Unlinks a single scene token from a user's account.
   * @param {string} userId
   * @param {string} token
   */
  async function unlinkScene(userId, token) {
    const docRef = accountsCollection.doc(userId);

    let result = { removed: false };
    await firestore.runTransaction(async (tx) => {
      const docSnap = await tx.get(docRef);
      if (!docSnap.exists) {
        return;
      }

      const { state, login, createdAt } = stateFromSnapshot(docSnap);
      result = applyUnlink(state, token, { now: now() });

      const payload = {
        login,
        scenes: result.state.scenes,
        sceneOrder: result.state.sceneOrder,
        removed: result.state.removed,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (createdAt !== undefined) {
        payload.createdAt = createdAt;
      }

      tx.set(docRef, payload);
    });

    return { removed: result.removed };
  }

  /**
   * Sets a user's scene display order.
   * @param {string} userId
   * @param {string[]} order
   */
  async function setSceneOrder(userId, order) {
    const docRef = accountsCollection.doc(userId);

    let sceneOrder = [];
    await firestore.runTransaction(async (tx) => {
      const docSnap = await tx.get(docRef);
      if (!docSnap.exists) {
        return;
      }

      const { state, login, createdAt } = stateFromSnapshot(docSnap);
      sceneOrder = normalizeSceneOrder(order, state.sceneOrder);

      const payload = {
        login,
        scenes: state.scenes,
        sceneOrder,
        removed: state.removed,
        updatedAt: FieldValue.serverTimestamp()
      };

      if (createdAt !== undefined) {
        payload.createdAt = createdAt;
      }

      tx.set(docRef, payload);
    });

    return { sceneOrder };
  }

  return { getAccount, linkScenes, unlinkScene, setSceneOrder };
}

module.exports = createAccountService();
module.exports.createAccountService = createAccountService;
