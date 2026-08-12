const test = require('node:test');
const assert = require('node:assert');
const { UUID_REGEX, validateToken, createTokenLimiter } = require('../../middleware/tokenValidation');

test('UUID_REGEX validates well-formed UUID v4 strings', () => {
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';
  assert.strictEqual(UUID_REGEX.test(validUuid), true);
});

test('UUID_REGEX rejects invalid UUID strings', () => {
  assert.strictEqual(UUID_REGEX.test('invalid-uuid-string'), false);
  assert.strictEqual(UUID_REGEX.test('123e4567e89b12d3a456426614174000'), false);
  assert.strictEqual(UUID_REGEX.test(''), false);
});

test('validateToken calls next() for valid UUID token param', () => {
  const req = { params: { token: '123e4567-e89b-12d3-a456-426614174000' } };
  let statusCalled = false;
  let nextCalled = false;

  const res = {
    status: () => {
      statusCalled = true;
      return res;
    },
    json: () => res
  };
  const next = () => {
    nextCalled = true;
  };

  validateToken(req, res, next);
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(statusCalled, false);
});

test('validateToken responds with 400 for invalid or missing token param', () => {
  const req = { params: { token: 'invalid' } };
  let statusCode = 0;
  let jsonResponse = null;
  let nextCalled = false;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      jsonResponse = data;
      return res;
    }
  };
  const next = () => {
    nextCalled = true;
  };

  validateToken(req, res, next);
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(statusCode, 400);
  assert.notStrictEqual(jsonResponse, null);
  assert.ok(jsonResponse.error.includes('Invalid token format'));
});

test('createTokenLimiter creates middleware function', () => {
  const limiter = createTokenLimiter({ max: 10, windowMs: 60000 });
  assert.strictEqual(typeof limiter, 'function');
});
