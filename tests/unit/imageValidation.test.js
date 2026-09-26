const test = require('node:test');
const assert = require('node:assert');
const {
  PUBLIC_URL_PREFIX,
  sniffImageType,
  sniffImageDataUrl,
  parseImageDataUrl,
  ownBucketObjectPath,
  isOwnBucketUrl,
  sanitizeImageUrl
} = require('../../utils/imageValidation');
const { REMOVED_CONFIG_KEYS, sanitizeSceneConfigValues } = require('../../utils/configValidation');
const { buildConfigWrite } = require('../../services/sceneConfigService');
const { FieldValue } = require('@google-cloud/firestore');
const { uploadDataUrlToGCS } = require('../../services/storageService');

const PAD = Buffer.alloc(16);
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), PAD]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), PAD]);
const GIF_BYTES = Buffer.concat([Buffer.from('GIF89a', 'latin1'), PAD]);
const WEBP_BYTES = Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP', 'latin1'), PAD]);
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

const dataUrl = (type, bytes) => `data:${type};base64,${bytes.toString('base64')}`;
const OWN_URL = `${PUBLIC_URL_PREFIX}backgrounds/0f8fad5b-d9cb-469f-a165-70867728950e.jpg`;

test('sniffImageType recognises PNG, JPEG, GIF and WebP and nothing else', () => {
  assert.strictEqual(sniffImageType(PNG_BYTES), 'image/png');
  assert.strictEqual(sniffImageType(JPEG_BYTES), 'image/jpeg');
  assert.strictEqual(sniffImageType(GIF_BYTES), 'image/gif');
  assert.strictEqual(sniffImageType(WEBP_BYTES), 'image/webp');
  assert.strictEqual(sniffImageType(SVG_BYTES), null);
  assert.strictEqual(sniffImageType(Buffer.alloc(4)), null);
});

test('parseImageDataUrl accepts raster images and takes the type from the bytes', () => {
  assert.deepStrictEqual(
    { ...parseImageDataUrl(dataUrl('image/png', PNG_BYTES)), buffer: undefined },
    { contentType: 'image/png', extension: 'png', buffer: undefined }
  );
  assert.strictEqual(parseImageDataUrl(dataUrl('image/jpg', JPEG_BYTES)).contentType, 'image/jpeg');
  // Declared PNG but actually a JPEG: stored as what it really is.
  assert.strictEqual(parseImageDataUrl(dataUrl('image/png', JPEG_BYTES)).contentType, 'image/jpeg');
});

test('image data URLs are matched case-insensitively on the MIME type', () => {
  assert.strictEqual(parseImageDataUrl(dataUrl('IMAGE/PNG', PNG_BYTES)).contentType, 'image/png');
  assert.strictEqual(parseImageDataUrl(dataUrl('Image/JPG', JPEG_BYTES)).contentType, 'image/jpeg');
  assert.strictEqual(parseImageDataUrl(dataUrl('IMAGE/SVG+XML', SVG_BYTES)), null);
});

test('sniffImageDataUrl checks the header only; parseImageDataUrl decodes the full payload', () => {
  const body = Buffer.concat([PNG_BYTES, Buffer.alloc(64 * 1024, 7)]);
  const url = dataUrl('image/png', body);
  assert.deepStrictEqual(sniffImageDataUrl(url), { contentType: 'image/png', base64: body.toString('base64') });
  assert.ok(parseImageDataUrl(url).buffer.equals(body));
  assert.strictEqual(sniffImageDataUrl(dataUrl('image/png', SVG_BYTES)), null);
});

test('parseImageDataUrl rejects SVG, disguised markup and malformed data URLs', () => {
  assert.strictEqual(parseImageDataUrl(dataUrl('image/svg+xml', SVG_BYTES)), null);
  assert.strictEqual(parseImageDataUrl(dataUrl('image/png', SVG_BYTES)), null);
  assert.strictEqual(parseImageDataUrl(dataUrl('image/x-icon', PNG_BYTES)), null);
  assert.strictEqual(parseImageDataUrl(dataUrl('text/html', PNG_BYTES)), null);
  assert.strictEqual(parseImageDataUrl(`${dataUrl('image/png', PNG_BYTES)}")`), null);
  assert.strictEqual(parseImageDataUrl('data:image/png,not-base64'), null);
  assert.strictEqual(parseImageDataUrl(42), null);
});

test('ownBucketObjectPath accepts canonical URLs for our bucket only', () => {
  assert.strictEqual(ownBucketObjectPath(OWN_URL), 'backgrounds/0f8fad5b-d9cb-469f-a165-70867728950e.jpg');
  assert.ok(isOwnBucketUrl(`${PUBLIC_URL_PREFIX}theme-backgrounds/abc/def.png`));

  const rejected = [
    `${PUBLIC_URL_PREFIX}../other-bucket/evil.png`,
    `${PUBLIC_URL_PREFIX}%2e%2e/other-bucket/evil.png`,
    `${PUBLIC_URL_PREFIX}backgrounds/a%20b.png`,
    `${PUBLIC_URL_PREFIX}backgrounds/a.png?x=1`,
    `${PUBLIC_URL_PREFIX}backgrounds/a.png#x`,
    `${PUBLIC_URL_PREFIX}backgrounds/a.png") , url("https://evil.example/x.png`,
    `${PUBLIC_URL_PREFIX}backgrounds\\a.png`,
    `${PUBLIC_URL_PREFIX}`,
    PUBLIC_URL_PREFIX.replace(/\/$/, '-evil/a.png'),
    OWN_URL.replace('https://', 'http://'),
    'https://evil.example/backgrounds/a.png',
    null
  ];
  for (const url of rejected) {
    assert.strictEqual(ownBucketObjectPath(url), null, `should reject ${url}`);
  }
});

test('sanitizeImageUrl keeps empty values, data URLs and our bucket, and drops the rest', () => {
  assert.strictEqual(sanitizeImageUrl(null), null);
  assert.strictEqual(sanitizeImageUrl(undefined), null);
  assert.strictEqual(sanitizeImageUrl(''), '');
  assert.strictEqual(sanitizeImageUrl('none'), 'none');
  assert.strictEqual(sanitizeImageUrl(OWN_URL), OWN_URL);
  const png = dataUrl('image/png', PNG_BYTES);
  assert.strictEqual(sanitizeImageUrl(png), png);

  assert.strictEqual(sanitizeImageUrl('https://evil.example/a.webp'), null);
  assert.strictEqual(sanitizeImageUrl('javascript:alert(1)'), null);
  assert.strictEqual(sanitizeImageUrl(dataUrl('image/svg+xml', SVG_BYTES)), null);
  assert.strictEqual(sanitizeImageUrl({ url: OWN_URL }), null);
});

test('sanitizeSceneConfigValues drops the removed endpoint keys and cleans bgImage', () => {
  const config = sanitizeSceneConfigValues({
    badgeEndpointUrlGlobal: 'https://evil.example/badges',
    badgeEndpointUrlChannel: 'https://evil.example/channel',
    cheermoteEndpointUrl: 'https://evil.example/cheermotes',
    bgImage: 'https://evil.example/bg.png',
    textColor: '#ffffff'
  });
  assert.deepStrictEqual(config, { bgImage: null, textColor: '#ffffff' });

  assert.strictEqual(sanitizeSceneConfigValues({ bgImage: OWN_URL }).bgImage, OWN_URL);
  assert.deepStrictEqual(sanitizeSceneConfigValues({}), {});
});

test('buildConfigWrite deletes stored copies of the removed endpoint keys', () => {
  const write = buildConfigWrite({ textColor: '#ffffff' });
  assert.strictEqual(write.textColor, '#ffffff');
  for (const key of REMOVED_CONFIG_KEYS) {
    assert.ok(write[key].isEqual(FieldValue.delete()), `${key} should be a delete sentinel`);
  }
});

test('uploadDataUrlToGCS refuses SVG and mismatched content before touching storage', async () => {
  assert.strictEqual(await uploadDataUrlToGCS(dataUrl('image/svg+xml', SVG_BYTES), 'x'), null);
  assert.strictEqual(await uploadDataUrlToGCS(dataUrl('image/png', SVG_BYTES), 'x'), null);
  assert.strictEqual(await uploadDataUrlToGCS('https://evil.example/a.png', 'x'), null);
});
