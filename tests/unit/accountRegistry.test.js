const test = require('node:test');
const assert = require('node:assert');
const {
  MAX_ACCOUNT_SCENES,
  MAX_TOMBSTONES,
  MAX_SCENE_NAME_LENGTH,
  emptyState,
  sanitizeSceneName,
  applyLink,
  applyUnlink,
  normalizeSceneOrder
} = require('../../utils/accountRegistry');

const T1 = '123e4567-e89b-12d3-a456-426614174000';
const T2 = '223e4567-e89b-12d3-a456-426614174001';
const T3 = '323e4567-e89b-12d3-a456-426614174002';

test('sanitizeSceneName trims, slices, and handles non-strings', () => {
  assert.strictEqual(sanitizeSceneName('  hello  '), 'hello');
  assert.strictEqual(sanitizeSceneName('a'.repeat(300)).length, MAX_SCENE_NAME_LENGTH);
  assert.strictEqual(sanitizeSceneName(null), '');
  assert.strictEqual(sanitizeSceneName(undefined), '');
  assert.strictEqual(sanitizeSceneName(42), '');
  assert.strictEqual(sanitizeSceneName(''), '');
});

test('applyLink appends new tokens to sceneOrder and dedupes within a request', () => {
  const result = applyLink(emptyState(), [
    { token: T1, name: 'Scene 1' },
    { token: T1, name: 'Scene 1 dupe' },
    { token: T2, name: 'Scene 2' }
  ], { now: 1000 });

  assert.deepStrictEqual(result.linked, [T1, T2]);
  assert.deepStrictEqual(result.state.sceneOrder, [T1, T2]);
  assert.strictEqual(result.state.scenes[T1].name, 'Scene 1');
  assert.strictEqual(result.state.scenes[T1].addedAt, 1000);
  assert.strictEqual(result.rejected.length, 0);
  assert.strictEqual(result.skipped.length, 0);
});

test('applyLink rejects non-UUID tokens with reason invalid', () => {
  const result = applyLink(emptyState(), [
    { token: 'not-a-uuid', name: 'x' },
    { token: 12345, name: 'y' }
  ]);

  assert.strictEqual(result.rejected.length, 2);
  assert.strictEqual(result.rejected[0].reason, 'invalid');
  assert.strictEqual(result.rejected[0].token, 'not-a-uuid');
  assert.strictEqual(result.rejected[1].reason, 'invalid');
  assert.strictEqual(result.rejected[1].token, '12345');
  assert.strictEqual(result.linked.length, 0);
});

test('applyLink lowercases tokens', () => {
  const upper = T1.toUpperCase();
  const result = applyLink(emptyState(), [{ token: upper, name: 'Scene' }]);

  assert.deepStrictEqual(result.linked, [T1]);
  assert.ok(result.state.scenes[T1]);
  assert.ok(!result.state.scenes[upper]);
});

test('applyLink skips tombstoned tokens unless force, and force clears the tombstone', () => {
  const state = { ...emptyState(), removed: { [T1]: 500 } };

  const skippedResult = applyLink(state, [{ token: T1, name: 'Scene' }], { now: 1000 });
  assert.deepStrictEqual(skippedResult.skipped, [T1]);
  assert.deepStrictEqual(skippedResult.linked, []);
  assert.strictEqual(skippedResult.state.removed[T1], 500);

  const forcedResult = applyLink(state, [{ token: T1, name: 'Scene' }], { force: true, now: 1000 });
  assert.deepStrictEqual(forcedResult.linked, [T1]);
  assert.deepStrictEqual(forcedResult.skipped, []);
  assert.strictEqual(forcedResult.state.removed[T1], undefined);
});

test('applyLink rejects beyond MAX_ACCOUNT_SCENES with reason cap', () => {
  const scenes = {};
  const sceneOrder = [];
  for (let i = 0; i < MAX_ACCOUNT_SCENES; i++) {
    const token = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    scenes[token] = { name: `Scene ${i}`, addedAt: 0 };
    sceneOrder.push(token);
  }
  const fullState = { scenes, sceneOrder, removed: {} };

  const result = applyLink(fullState, [{ token: T1, name: 'Overflow' }]);

  assert.strictEqual(result.linked.length, 0);
  assert.strictEqual(result.rejected.length, 1);
  assert.strictEqual(result.rejected[0].token, T1);
  assert.strictEqual(result.rejected[0].reason, 'cap');
  assert.strictEqual(Object.keys(result.state.scenes).length, MAX_ACCOUNT_SCENES);
});

test('applyLink updates an existing token name only when the new name is non-empty', () => {
  const state = {
    scenes: { [T1]: { name: 'Old Name', addedAt: 100 } },
    sceneOrder: [T1],
    removed: {}
  };

  const noopResult = applyLink(state, [{ token: T1, name: '   ' }]);
  assert.strictEqual(noopResult.state.scenes[T1].name, 'Old Name');
  assert.deepStrictEqual(noopResult.existing, [T1]);
  assert.deepStrictEqual(noopResult.linked, []);
  assert.deepStrictEqual(noopResult.skipped, []);

  const updateResult = applyLink(state, [{ token: T1, name: 'New Name' }]);
  assert.strictEqual(updateResult.state.scenes[T1].name, 'New Name');
  assert.strictEqual(updateResult.state.scenes[T1].addedAt, 100);
  assert.deepStrictEqual(updateResult.existing, [T1]);
  assert.deepStrictEqual(updateResult.linked, []);
});

test('applyLink does not mutate the input state', () => {
  const state = {
    scenes: { [T1]: { name: 'Existing', addedAt: 1 } },
    sceneOrder: [T1],
    removed: { [T2]: 5 }
  };
  const snapshot = JSON.parse(JSON.stringify(state));

  applyLink(state, [{ token: T2, name: 'x' }, { token: T3, name: 'y' }], { force: true });

  assert.deepStrictEqual(state, snapshot);
});

test('applyLink tolerates a missing/partial state', () => {
  const result = applyLink(undefined, [{ token: T1, name: 'Scene' }]);
  assert.deepStrictEqual(result.linked, [T1]);
  assert.deepStrictEqual(result.state.sceneOrder, [T1]);

  const partial = applyLink({ scenes: {} }, [{ token: T2, name: 'Scene' }]);
  assert.deepStrictEqual(partial.linked, [T2]);
});

test('applyUnlink removes from scenes and order, and writes a tombstone', () => {
  const state = {
    scenes: { [T1]: { name: 'Scene', addedAt: 1 }, [T2]: { name: 'Scene 2', addedAt: 2 } },
    sceneOrder: [T1, T2],
    removed: {}
  };

  const result = applyUnlink(state, T1, { now: 999 });

  assert.strictEqual(result.removed, true);
  assert.strictEqual(result.state.scenes[T1], undefined);
  assert.deepStrictEqual(result.state.sceneOrder, [T2]);
  assert.strictEqual(result.state.removed[T1], 999);
  assert.deepStrictEqual(state.sceneOrder, [T1, T2]); // input untouched
});

test('applyUnlink returns removed=false for an unknown token but still writes tombstone', () => {
  const result = applyUnlink(emptyState(), T3, { now: 42 });
  assert.strictEqual(result.removed, false);
  assert.strictEqual(result.state.removed[T3], 42);
});

test('applyUnlink trims tombstones to the newest MAX_TOMBSTONES entries', () => {
  const removed = {};
  for (let i = 0; i < MAX_TOMBSTONES; i++) {
    const token = `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`;
    removed[token] = i; // ascending timestamps, oldest = 0
  }
  const state = { scenes: {}, sceneOrder: [], removed };

  const result = applyUnlink(state, T1, { now: 1000000 });

  assert.strictEqual(Object.keys(result.state.removed).length, MAX_TOMBSTONES);
  // the very oldest tombstone (timestamp 0) should have been evicted
  const oldestToken = `00000000-0000-4000-9000-${String(0).padStart(12, '0')}`;
  assert.strictEqual(result.state.removed[oldestToken], undefined);
  // the newest existing tombstone should survive
  const newestToken = `00000000-0000-4000-9000-${String(MAX_TOMBSTONES - 1).padStart(12, '0')}`;
  assert.strictEqual(result.state.removed[newestToken], MAX_TOMBSTONES - 1);
  // and the just-added one should be present
  assert.strictEqual(result.state.removed[T1], 1000000);
});

test('normalizeSceneOrder drops unknown tokens, dedupes, and appends missing in prior order', () => {
  const currentOrder = [T1, T2, T3];

  const result = normalizeSceneOrder([T2, T2, 'unknown-token', T2], currentOrder);
  assert.deepStrictEqual(result, [T2, T1, T3]);
});

test('normalizeSceneOrder drops non-string entries and handles empty/missing submitted', () => {
  assert.deepStrictEqual(normalizeSceneOrder([null, 5, T2], [T1, T2]), [T2, T1]);
  assert.deepStrictEqual(normalizeSceneOrder(undefined, [T1, T2]), [T1, T2]);
  assert.deepStrictEqual(normalizeSceneOrder([], []), []);
});
