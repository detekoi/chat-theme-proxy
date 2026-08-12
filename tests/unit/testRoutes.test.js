const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const testRoutes = require('../../routes/testRoutes');

function createTestApp() {
  const app = express();
  app.use('/', testRoutes);
  return app;
}

test('GET /health returns 200 OK text', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.strictEqual(text, 'Theme Generator API is running');
  } finally {
    server.close();
  }
});

test('GET /debug returns status and environment details', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/debug`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'running');
    assert.ok(Array.isArray(data.borderRadiusPresets));
    assert.ok(Array.isArray(data.boxShadowPresets));
    assert.strictEqual(typeof data.fontCount, 'number');
  } finally {
    server.close();
  }
});

test('GET /test-theme returns debug theme payload', async () => {
  const app = createTestApp();
  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://localhost:${port}/test-theme`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.themeData);
    assert.strictEqual(data.themeData.theme_name, 'Debug Test Theme');
    assert.strictEqual(data.themeData.border_radius, 'Rounded');
  } finally {
    server.close();
  }
});
