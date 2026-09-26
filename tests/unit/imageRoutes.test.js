const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const express = require('express');

// Stub the Firestore/GCS-backed services before the routes load them.
const calls = { upload: [], addTheme: [], upsert: [] };
let uploadResult = null;
let addThemeError = null;

function stub(relPath, exports) {
  const file = path.join(__dirname, '../..', relPath);
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

const { LibraryFullError } = require('../../services/themeLibraryService');
stub('services/storageService.js', {
  uploadDataUrlToGCS: async (...args) => { calls.upload.push(args); return uploadResult; },
  deleteImagesForToken: () => {},
  deleteImagesForTheme: () => {},
  copyToThemeBackground: async () => undefined
});
stub('services/themeLibraryService.js', {
  getLibrary: async () => ({ themes: [] }),
  addTheme: async (token, theme) => {
    if (addThemeError) throw addThemeError;
    calls.addTheme.push(theme);
    return theme;
  },
  deleteTheme: async () => null,
  setActiveTheme: async () => {},
  LibraryFullError
});
stub('services/sceneConfigService.js', {
  upsertSceneConfig: async (token, data) => { calls.upsert.push(data); },
  getSceneConfig: async () => null,
  deleteSceneConfig: async () => {}
});

const app = express();
app.use('/api', require('../../routes/sceneConfigRoutes'));
app.use('/api', require('../../routes/themeLibraryRoutes'));

const TOKEN = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PNG = `data:IMAGE/PNG;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]).toString('base64')}`;
const GCS_URL = `https://storage.googleapis.com/chat-themer-backgrounds/theme-backgrounds/${TOKEN}/x.png`;

async function request(method, url, body) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://localhost:${server.address().port}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

test.beforeEach(() => {
  calls.upload.length = 0;
  calls.addTheme.length = 0;
  calls.upsert.length = 0;
  uploadResult = null;
  addThemeError = null;
});

test('scene config: an upper-case image data URL is uploaded, not stored inline', async () => {
  uploadResult = GCS_URL;
  const res = await request('PUT', `/api/scene-config/${TOKEN}`, { config: { bgImage: PNG } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(calls.upload.length, 1);
  assert.strictEqual(calls.upsert[0].config.bgImage, GCS_URL);
});

test('scene config: preChromaKeyColor survives the save', async () => {
  await request('PUT', `/api/scene-config/${TOKEN}`, { config: { chromaKey: true, preChromaKeyColor: '#123456' } });
  assert.strictEqual(calls.upsert[0].config.preChromaKeyColor, '#123456');
});

test('theme library: an upper-case image data URL is uploaded', async () => {
  uploadResult = GCS_URL;
  const res = await request('POST', `/api/theme-library/${TOKEN}/themes`, { theme: { value: 'v', backgroundImage: PNG } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(calls.upload.length, 1);
  assert.strictEqual(calls.addTheme[0].backgroundImage, GCS_URL);
});

test('theme library: a failed upload stores the theme without its image, never the data URL', async () => {
  uploadResult = null;
  const res = await request('POST', `/api/theme-library/${TOKEN}/themes`, { theme: { value: 'v', backgroundImage: PNG } });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(calls.addTheme[0].backgroundImage, null);
});

test('theme library: a full library returns 413 instead of a failed write', async () => {
  addThemeError = new LibraryFullError();
  const res = await request('POST', `/api/theme-library/${TOKEN}/themes`, { theme: { value: 'v' } });
  assert.strictEqual(res.status, 413);
  assert.match(res.body.error, /full/);
});
