const test = require('node:test');
const assert = require('node:assert');
const { createRequireTwitchUser, VALIDATE_URL } = require('../../middleware/twitchAuth');

const CLIENT_ID = 'test-client-id';

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

function makeReq(authHeader) {
  const headers = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return { headers };
}

function makeHttpClient(responder) {
  let calls = 0;
  return {
    get: async (url, opts) => {
      calls += 1;
      return responder(url, opts, calls);
    },
    get calls() {
      return calls;
    }
  };
}

test('missing Authorization header -> 401, next not called, httpClient not called', async () => {
  const httpClient = makeHttpClient(() => ({ status: 200, data: {} }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq(undefined);
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(httpClient.calls, 0);
});

test('malformed Authorization header -> 401, httpClient not called', async () => {
  const httpClient = makeHttpClient(() => ({ status: 200, data: {} }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Basic abc123');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(httpClient.calls, 0);
});

test('Bearer scheme with valid token and matching client_id calls next with req.twitchUser', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: CLIENT_ID, user_id: 12345, login: 'someuser', expires_in: 3600 }
  }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Bearer sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.statusCode, null);
  assert.deepStrictEqual(req.twitchUser, { id: '12345', login: 'someuser' });
  assert.strictEqual(typeof req.twitchUser.id, 'string');
});

test('app access token (200, matching client_id, no user_id) -> 401, not cached', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: CLIENT_ID, scopes: [], expires_in: 5000000 }
  }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Bearer apptoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(req.twitchUser, undefined);
  assert.strictEqual(middleware.cache.size, 0);
});

test('OAuth scheme is also accepted', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: CLIENT_ID, user_id: 999, login: 'other', expires_in: 3600 }
  }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('OAuth sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.deepStrictEqual(req.twitchUser, { id: '999', login: 'other' });
});

test('valid token but different client_id -> 401', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: 'someone-elses-app', user_id: 1, login: 'x', expires_in: 3600 }
  }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Bearer sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(nextCalled, false);
});

test('Twitch returns 401 -> 401', async () => {
  const httpClient = makeHttpClient(() => ({ status: 401, data: { message: 'invalid access token' } }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Bearer badtoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 401);
  assert.deepStrictEqual(res.body, { error: 'Invalid or expired Twitch token.' });
  assert.strictEqual(nextCalled, false);
});

test('httpClient throws -> 503', async () => {
  const httpClient = {
    calls: 0,
    get: async () => {
      httpClient.calls += 1;
      throw new Error('network error');
    }
  };
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID, logger: { warn() {} } });
  const req = makeReq('Bearer sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(httpClient.calls, 1);
});

test('Twitch returns 500 -> 503', async () => {
  const httpClient = makeHttpClient(() => ({ status: 500, data: {} }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });
  const req = makeReq('Bearer sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(nextCalled, false);
});

test('missing clientId -> 503 and httpClient never called', async () => {
  const httpClient = makeHttpClient(() => ({ status: 200, data: {} }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: undefined, logger: { warn() {} } });
  const req = makeReq('Bearer sometoken');
  const res = makeRes();
  let nextCalled = false;

  await middleware(req, res, () => { nextCalled = true; });

  assert.strictEqual(res.statusCode, 503);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(httpClient.calls, 0);
});

test('same token validated twice within TTL -> httpClient called once', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: CLIENT_ID, user_id: 1, login: 'x', expires_in: 3600 }
  }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });

  const req1 = makeReq('Bearer sometoken');
  await middleware(req1, makeRes(), () => {});
  const req2 = makeReq('Bearer sometoken');
  await middleware(req2, makeRes(), () => {});

  assert.strictEqual(httpClient.calls, 1);
  assert.deepStrictEqual(req2.twitchUser, { id: '1', login: 'x' });
});

test('cache entry expires -> second http call after now advances past expiry', async () => {
  const httpClient = makeHttpClient(() => ({
    status: 200,
    data: { client_id: CLIENT_ID, user_id: 1, login: 'x', expires_in: 3600 }
  }));
  let currentTime = 1000;
  const middleware = createRequireTwitchUser({
    httpClient,
    clientId: CLIENT_ID,
    now: () => currentTime,
    cacheTtlMs: 5000
  });

  const req1 = makeReq('Bearer sometoken');
  await middleware(req1, makeRes(), () => {});
  assert.strictEqual(httpClient.calls, 1);

  currentTime += 10000; // past TTL

  const req2 = makeReq('Bearer sometoken');
  await middleware(req2, makeRes(), () => {});
  assert.strictEqual(httpClient.calls, 2);
});

test('a 401 result is not cached -> two requests produce two http calls', async () => {
  const httpClient = makeHttpClient(() => ({ status: 401, data: {} }));
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID });

  await middleware(makeReq('Bearer badtoken'), makeRes(), () => {});
  await middleware(makeReq('Bearer badtoken'), makeRes(), () => {});

  assert.strictEqual(httpClient.calls, 2);
});

test('cache cap: maxCacheEntries=2, third distinct token evicts the oldest, first re-validates', async () => {
  const httpClient = makeHttpClient((url, opts) => {
    const token = opts.headers.Authorization.replace('OAuth ', '');
    return {
      status: 200,
      data: { client_id: CLIENT_ID, user_id: token, login: token, expires_in: 3600 }
    };
  });
  const middleware = createRequireTwitchUser({ httpClient, clientId: CLIENT_ID, maxCacheEntries: 2 });

  await middleware(makeReq('Bearer token1'), makeRes(), () => {});
  await middleware(makeReq('Bearer token2'), makeRes(), () => {});
  await middleware(makeReq('Bearer token3'), makeRes(), () => {});
  assert.strictEqual(httpClient.calls, 3);

  // token1 should have been evicted (oldest); revalidating it makes a 4th http call
  await middleware(makeReq('Bearer token1'), makeRes(), () => {});
  assert.strictEqual(httpClient.calls, 4);

  // token3 should still be cached (most recently inserted, not evicted)
  await middleware(makeReq('Bearer token3'), makeRes(), () => {});
  assert.strictEqual(httpClient.calls, 4);
});

test('VALIDATE_URL points at the Twitch validate endpoint', () => {
  assert.strictEqual(VALIDATE_URL, 'https://id.twitch.tv/oauth2/validate');
});
