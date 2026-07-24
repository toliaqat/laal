import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ActionError, fail, succeed } from './action-result.ts';

test('fail() produces a not-ok state carrying code, values and detail', () => {
  const state = fail('file_too_large', { maxMb: 20 }, 'raw db message');
  assert.deepEqual(state, {
    ok: false,
    code: 'file_too_large',
    values: { maxMb: 20 },
    detail: 'raw db message',
  });
});

test('fail() without extras omits values/detail content', () => {
  const state = fail('unexpected');
  assert.equal(state?.ok, false);
  if (state && !state.ok) {
    assert.equal(state.code, 'unexpected');
    assert.equal(state.values, undefined);
    assert.equal(state.detail, undefined);
  }
});

test('succeed() produces an ok state with an optional message', () => {
  assert.deepEqual(succeed(), { ok: true, message: undefined });
  assert.deepEqual(succeed('Saved.'), { ok: true, message: 'Saved.' });
});

test('ActionError round-trips code, values and detail through fail()', () => {
  const err = new ActionError('cover_too_large', { maxMb: 20 }, 'too big');
  assert.equal(err.name, 'ActionError');
  assert.ok(err instanceof Error);
  const state = fail(err.code, err.values, err.message);
  assert.deepEqual(state, {
    ok: false,
    code: 'cover_too_large',
    values: { maxMb: 20 },
    detail: 'too big',
  });
});

test('ActionError message defaults to its code', () => {
  assert.equal(new ActionError('not_authorized').message, 'not_authorized');
});
