import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monogram } from './monogram.ts';

/**
 * The same cases `initials()` in apps/mobile/lib/theme.ts produces, so a
 * family sees identical initials on the web and in the app.
 */

test('two words give the first letter of each', () => {
  assert.equal(monogram('Ahmed Khan'), 'AK');
  assert.equal(monogram('  ahmed   raza khan '), 'AR');
});

test('one word gives its first two letters', () => {
  assert.equal(monogram('Ayesha'), 'AY');
  assert.equal(monogram('A'), 'A');
});

test('Urdu names keep their letters (no case to change)', () => {
  assert.equal(monogram('محمد علی'), 'مع');
  assert.equal(monogram('فاطمہ'), 'فا');
});

test('a blank name falls back to a quiet dot', () => {
  assert.equal(monogram(''), '·');
  assert.equal(monogram('   '), '·');
  assert.equal(monogram(null), '·');
  assert.equal(monogram(undefined), '·');
});
