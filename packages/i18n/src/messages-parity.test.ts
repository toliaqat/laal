import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * en.json and ur.json must expose exactly the same key set: a key present in
 * one locale but not the other renders as a raw key path (or crashes ICU
 * formatting) at runtime. This guards the whole class.
 */

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  const path = fileURLToPath(
    new URL(`../messages/${locale}.json`, import.meta.url),
  );
  return JSON.parse(readFileSync(path, 'utf8')) as Messages;
}

function flatKeys(node: Messages, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      for (const k of flatKeys(value as Messages, path)) out.add(k);
    } else {
      out.add(path);
    }
  }
  return out;
}

/** ICU placeholders like {maxMb} must match between locales for each key. */
function placeholders(value: string): string {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
}

function flatEntries(node: Messages, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      for (const [k, v] of flatEntries(value as Messages, path)) out.set(k, v);
    } else {
      out.set(path, String(value));
    }
  }
  return out;
}

test('en and ur expose identical message keys', () => {
  const en = flatKeys(load('en'));
  const ur = flatKeys(load('ur'));
  const missingInUr = [...en].filter((k) => !ur.has(k));
  const missingInEn = [...ur].filter((k) => !en.has(k));
  assert.deepEqual(missingInUr, [], `keys missing in ur.json`);
  assert.deepEqual(missingInEn, [], `keys missing in en.json`);
});

test('en and ur use identical ICU placeholders per key', () => {
  const en = flatEntries(load('en'));
  const ur = flatEntries(load('ur'));
  const mismatched = [...en]
    .filter(([k, v]) => ur.has(k) && placeholders(v) !== placeholders(ur.get(k)!))
    .map(([k]) => k);
  assert.deepEqual(mismatched, [], 'placeholder mismatch between locales');
});
