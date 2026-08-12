const test = require('node:test');
const assert = require('node:assert');
const { getBorderRadiusValue, getBoxShadowValue, generateThemeStorageKey } = require('../../utils/helpers');

test('getBorderRadiusValue returns correct preset values', () => {
  assert.strictEqual(getBorderRadiusValue('Subtle'), '8px');
  assert.strictEqual(getBorderRadiusValue('Rounded'), '16px');
  assert.strictEqual(getBorderRadiusValue('Pill'), '24px');
  assert.strictEqual(getBorderRadiusValue('None'), '0px');
});

test('getBorderRadiusValue falls back to None for unknown presets', () => {
  assert.strictEqual(getBorderRadiusValue('UnknownPreset'), '0px');
  assert.strictEqual(getBorderRadiusValue(undefined), '0px');
});

test('getBoxShadowValue returns correct preset values', () => {
  assert.strictEqual(getBoxShadowValue('None'), 'none');
  assert.strictEqual(getBoxShadowValue('Soft'), 'rgba(99, 99, 99, 0.2) 0px 2px 8px 0px');
});

test('getBoxShadowValue falls back to None for unknown presets', () => {
  assert.strictEqual(getBoxShadowValue('NonExistent'), 'none');
  assert.strictEqual(getBoxShadowValue(null), 'none');
});

test('generateThemeStorageKey generates correct storage key', () => {
  assert.strictEqual(generateThemeStorageKey('abc-123'), 'generated-theme-image-abc-123');
});
