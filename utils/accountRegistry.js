// utils/accountRegistry.js
const { UUID_REGEX } = require('../middleware/tokenValidation');

const MAX_ACCOUNT_SCENES = 100;
const MAX_SCENE_NAME_LENGTH = 200;
const MAX_TOMBSTONES = 200;

/**
 * Returns a fresh, empty account registry state.
 * @returns {{ scenes: Object, sceneOrder: string[], removed: Object }}
 */
function emptyState() {
  return { scenes: {}, sceneOrder: [], removed: {} };
}

/**
 * Sanitizes a scene name: trims whitespace and caps length. Non-string input
 * (or a string that trims to nothing meaningful) becomes an empty string.
 * @param {*} name
 * @returns {string}
 */
function sanitizeSceneName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_SCENE_NAME_LENGTH);
}

/**
 * Normalizes a possibly-partial state object by filling in missing pieces
 * from emptyState(), without mutating the input.
 * @param {*} state
 * @returns {{ scenes: Object, sceneOrder: string[], removed: Object }}
 */
function normalizeState(state) {
  const base = emptyState();
  const scenes = (state && typeof state.scenes === 'object' && state.scenes !== null) ? state.scenes : base.scenes;
  const sceneOrder = (state && Array.isArray(state.sceneOrder)) ? state.sceneOrder : base.sceneOrder;
  const removed = (state && typeof state.removed === 'object' && state.removed !== null) ? state.removed : base.removed;
  return { scenes, sceneOrder, removed };
}

/**
 * Links one or more scene tokens into an account's registry state.
 *
 * @param {*} state - existing (possibly partial/missing) registry state; never mutated
 * @param {Array<{ token: *, name: * }>} incoming
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - if true, clears tombstones and re-links
 * @param {number} [options.now=Date.now()]
 * @returns {{ state: Object, linked: string[], skipped: string[], rejected: Array<{token: string, reason: string}>, existing: string[] }}
 */
function applyLink(state, incoming, { force = false, now = Date.now() } = {}) {
  const current = normalizeState(state);

  const scenes = { ...current.scenes };
  const removed = { ...current.removed };
  let sceneOrder = current.sceneOrder.slice();

  const linked = [];
  const skipped = [];
  const rejected = [];
  const existing = [];
  const seen = new Set();

  const items = Array.isArray(incoming) ? incoming : [];

  for (const item of items) {
    const rawToken = item && item.token;
    const tokenStr = String(rawToken);

    if (typeof rawToken !== 'string' || !UUID_REGEX.test(rawToken)) {
      rejected.push({ token: tokenStr, reason: 'invalid' });
      continue;
    }

    const token = rawToken.toLowerCase();

    if (seen.has(token)) continue;
    seen.add(token);

    if (removed[token] !== undefined && !force) {
      skipped.push(token);
      continue;
    }
    if (removed[token] !== undefined && force) {
      delete removed[token];
    }

    if (scenes[token]) {
      const sanitized = sanitizeSceneName(item.name);
      if (sanitized !== '') {
        scenes[token] = { ...scenes[token], name: sanitized };
      }
      existing.push(token);
      continue;
    }

    const scenesCount = Object.keys(scenes).length;
    if (scenesCount >= MAX_ACCOUNT_SCENES) {
      rejected.push({ token, reason: 'cap' });
      continue;
    }

    scenes[token] = { name: sanitizeSceneName(item.name), addedAt: now };
    linked.push(token);
  }

  // Repair sceneOrder: dedupe, drop tokens not in scenes, append missing linked tokens.
  const orderSeen = new Set();
  const repairedOrder = [];
  for (const t of sceneOrder) {
    if (typeof t !== 'string') continue;
    if (orderSeen.has(t)) continue;
    if (!scenes[t]) continue;
    orderSeen.add(t);
    repairedOrder.push(t);
  }
  for (const t of linked) {
    if (!orderSeen.has(t)) {
      orderSeen.add(t);
      repairedOrder.push(t);
    }
  }
  sceneOrder = repairedOrder;

  return {
    state: { scenes, sceneOrder, removed },
    linked,
    skipped,
    rejected,
    existing
  };
}

/**
 * Unlinks a single scene token from an account's registry state, writing a
 * tombstone so future non-forced links are skipped.
 *
 * @param {*} state
 * @param {string} token
 * @param {Object} [options]
 * @param {number} [options.now=Date.now()]
 * @returns {{ state: Object, removed: boolean }}
 */
function applyUnlink(state, token, { now = Date.now() } = {}) {
  const current = normalizeState(state);

  const scenes = { ...current.scenes };
  const removed = { ...current.removed };

  const wasLinked = Boolean(scenes[token]);
  if (wasLinked) {
    delete scenes[token];
  }

  const sceneOrder = current.sceneOrder.filter((t) => t !== token);

  removed[token] = now;

  let removedEntries = Object.entries(removed);
  if (removedEntries.length > MAX_TOMBSTONES) {
    removedEntries.sort((a, b) => a[1] - b[1]);
    removedEntries = removedEntries.slice(removedEntries.length - MAX_TOMBSTONES);
  }
  const trimmedRemoved = Object.fromEntries(removedEntries);

  return {
    state: { scenes, sceneOrder, removed: trimmedRemoved },
    removed: wasLinked
  };
}

/**
 * Normalizes a submitted scene order against the current known order: keeps
 * only tokens that exist in currentOrder, dedupes, then appends any
 * currentOrder tokens that were not submitted (in their existing order).
 *
 * @param {*} submitted
 * @param {*} currentOrder
 * @returns {string[]}
 */
function normalizeSceneOrder(submitted, currentOrder) {
  const known = Array.isArray(currentOrder) ? currentOrder : [];
  const knownSet = new Set(known.filter((t) => typeof t === 'string'));

  const submittedList = Array.isArray(submitted) ? submitted : [];
  const result = [];
  const seen = new Set();

  for (const t of submittedList) {
    if (typeof t !== 'string') continue;
    if (!knownSet.has(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }

  for (const t of known) {
    if (typeof t !== 'string') continue;
    if (seen.has(t)) continue;
    seen.add(t);
    result.push(t);
  }

  return result;
}

module.exports = {
  MAX_ACCOUNT_SCENES,
  MAX_SCENE_NAME_LENGTH,
  MAX_TOMBSTONES,
  emptyState,
  sanitizeSceneName,
  applyLink,
  applyUnlink,
  normalizeSceneOrder
};
