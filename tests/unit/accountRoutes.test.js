const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { createAccountRouter } = require('../../routes/accountRoutes');

function fakeAuth(req, res, next) {
  req.twitchUser = { id: '42', login: 'tester' };
  next();
}

function unauthorizedAuth(req, res) {
  return res.status(401).json({ error: 'x' });
}

function createFakeService(overrides = {}) {
  const calls = [];
  return {
    calls,
    getAccount: async (userId) => {
      calls.push({ method: 'getAccount', userId });
      if (overrides.getAccount) return overrides.getAccount(userId);
      return { scenes: [{ token: 'a', name: 'Scene A', exists: true, updatedAt: null, config: null }], sceneOrder: ['a'] };
    },
    linkScenes: async (userId, login, incoming, options) => {
      calls.push({ method: 'linkScenes', userId, login, incoming, options });
      if (overrides.linkScenes) return overrides.linkScenes(userId, login, incoming, options);
      return { linked: [], skipped: [], existing: [], rejected: [], sceneOrder: [] };
    },
    unlinkScene: async (userId, token) => {
      calls.push({ method: 'unlinkScene', userId, token });
      if (overrides.unlinkScene) return overrides.unlinkScene(userId, token);
      return { removed: true };
    },
    setSceneOrder: async (userId, order) => {
      calls.push({ method: 'setSceneOrder', userId, order });
      if (overrides.setSceneOrder) return overrides.setSceneOrder(userId, order);
      return { sceneOrder: order };
    }
  };
}

function createTestApp({ accountService, requireTwitchUser } = {}) {
  const router = createAccountRouter({
    accountService: accountService || createFakeService(),
    requireTwitchUser: requireTwitchUser || fakeAuth
  });
  const app = express();
  app.use('/api', router);
  return app;
}

async function withServer(app, fn) {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    await fn(port);
  } finally {
    server.close();
  }
}

const VALID_TOKEN = '11111111-1111-4111-8111-111111111111';

test('GET /api/account returns envelope with user, scenes, sceneOrder', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data.user, { id: '42', login: 'tester' });
    assert.ok(Array.isArray(data.scenes));
    assert.ok(Array.isArray(data.sceneOrder));
    assert.strictEqual(service.calls[0].method, 'getAccount');
    assert.strictEqual(service.calls[0].userId, '42');
  });
});

test('POST /api/account/scenes 400 on missing scenes', async () => {
  const app = createTestApp();
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });
});

test('POST /api/account/scenes 400 on empty scenes array', async () => {
  const app = createTestApp();
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes: [] })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('POST /api/account/scenes 400 on oversized scenes array (101 entries)', async () => {
  const app = createTestApp();
  const scenes = Array.from({ length: 101 }, (_, i) => ({ token: `token-${i}`, name: 'x' }));
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('POST /api/account/scenes 400 on non-object entries', async () => {
  const app = createTestApp();
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes: ['not-an-object'] })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('POST /api/account/scenes 400 on non-string token', async () => {
  const app = createTestApp();
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes: [{ token: 123, name: 'x' }] })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('POST /api/account/scenes passes force through and lowercases tokens', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service });
  const upperToken = VALID_TOKEN.toUpperCase();

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenes: [{ token: upperToken, name: 'Scene' }], force: true })
    });
    assert.strictEqual(res.status, 200);
    const call = service.calls.find((c) => c.method === 'linkScenes');
    assert.ok(call);
    assert.strictEqual(call.options.force, true);
    assert.strictEqual(call.incoming[0].token, VALID_TOKEN);
    assert.strictEqual(call.userId, '42');
    assert.strictEqual(call.login, 'tester');
  });
});

test('DELETE /api/account/scenes/:token 400 on bad UUID', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes/not-a-uuid`, { method: 'DELETE' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(service.calls.length, 0);
  });
});

test('DELETE /api/account/scenes/:token calls service with the token', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scenes/${VALID_TOKEN}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.token, VALID_TOKEN);
    assert.strictEqual(data.removed, true);
    const call = service.calls.find((c) => c.method === 'unlinkScene');
    assert.ok(call);
    assert.strictEqual(call.userId, '42');
    assert.strictEqual(call.token, VALID_TOKEN);
  });
});

test('PUT /api/account/scene-order 400 on non-array', async () => {
  const app = createTestApp();
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scene-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneOrder: 'not-an-array' })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('PUT /api/account/scene-order 400 on oversized array (101 entries)', async () => {
  const app = createTestApp();
  const sceneOrder = Array.from({ length: 101 }, (_, i) => `token-${i}`);
  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scene-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneOrder })
    });
    assert.strictEqual(res.status, 400);
  });
});

test('PUT /api/account/scene-order returns service order', async () => {
  const service = createFakeService({
    setSceneOrder: async (userId, order) => ({ sceneOrder: order.slice().reverse() })
  });
  const app = createTestApp({ accountService: service });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scene-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneOrder: ['a', 'b'] })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data.sceneOrder, ['b', 'a']);
  });
});

test('PUT /api/account/scene-order lowercases tokens before reaching the service', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account/scene-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneOrder: ['123E4567-E89B-12D3-A456-426614174000', 'abc'] })
    });
    assert.strictEqual(res.status, 200);
    const call = service.calls.find((c) => c.method === 'setSceneOrder');
    assert.deepStrictEqual(call.order, ['123e4567-e89b-12d3-a456-426614174000', 'abc']);
  });
});

test('auth middleware that responds 401 stops the handler', async () => {
  const service = createFakeService();
  const app = createTestApp({ accountService: service, requireTwitchUser: unauthorizedAuth });

  await withServer(app, async (port) => {
    const res = await fetch(`http://localhost:${port}/api/account`);
    assert.strictEqual(res.status, 401);
    assert.strictEqual(service.calls.length, 0);
  });
});
