import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupabasePublicKey } from '../lib/supabase-public-key.mjs';

function jwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role })}.signature`;
}

test('accepts modern Supabase publishable keys', () => {
  assert.equal(isSupabasePublicKey('sb_publishable_example'), true);
});

test('accepts legacy anon JWT keys', () => {
  assert.equal(isSupabasePublicKey(jwt('anon')), true);
});

test('rejects service role JWT keys', () => {
  assert.equal(isSupabasePublicKey(jwt('service_role')), false);
});

test('rejects malformed and empty keys', () => {
  for (const key of ['', null, undefined, 'not-a-key', jwt('authenticated')]) {
    assert.equal(isSupabasePublicKey(key), false);
  }
});
