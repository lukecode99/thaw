// Live integration tests for the thaw-relay Worker.
// Run: RELAY_URL=https://thaw-relay.<subdomain>.workers.dev npm run test:relay
// Skipped entirely when RELAY_URL is not set, so `npm test` stays hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.RELAY_URL?.replace(/\/$/, '');
const skip = BASE ? false : 'RELAY_URL not set';

const opaque = (n) => 'A'.repeat(n); // base64-shaped filler

test('pairing session: create, exchange both slots, delete', { skip }, async () => {
  let r = await fetch(`${BASE}/v1/pairings`, { method: 'POST' });
  assert.equal(r.status, 201);
  const { code, expiresIn } = await r.json();
  assert.match(code, /^[A-Z2-9]{6}$/);
  assert.ok(expiresIn <= 600, 'pairing sessions must expire within 10 minutes');

  r = await fetch(`${BASE}/v1/pairings/${code}/a`, { method: 'PUT', body: 'cGF5bG9hZEE=' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairings/${code}/b`, { method: 'PUT', body: 'cGF5bG9hZEI=' });
  assert.equal(r.status, 204);

  r = await fetch(`${BASE}/v1/pairings/${code}/a`);
  assert.equal(await r.text(), 'cGF5bG9hZEE=');
  r = await fetch(`${BASE}/v1/pairings/${code}/b`);
  assert.equal(await r.text(), 'cGF5bG9hZEI=');

  r = await fetch(`${BASE}/v1/pairings/${code}`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairings/${code}/a`);
  assert.equal(r.status, 404);
});

test('pairing payloads to unknown sessions are refused', { skip }, async () => {
  const r = await fetch(`${BASE}/v1/pairings/ZZZZZ2/a`, { method: 'PUT', body: 'cGF5bG9hZA==' });
  assert.equal(r.status, 404);
});

test('non-opaque payloads are rejected', { skip }, async () => {
  const r = await fetch(`${BASE}/v1/pairings`, { method: 'POST' });
  const { code } = await r.json();
  const plaintext = JSON.stringify({ note: 'raw text with spaces — must be refused' });
  const put = await fetch(`${BASE}/v1/pairings/${code}/a`, { method: 'PUT', body: plaintext });
  assert.equal(put.status, 400);
  assert.equal((await put.json()).error, 'not_opaque');
});

test('oversized payloads are rejected', { skip }, async () => {
  const r = await fetch(`${BASE}/v1/pairs/pair-size-test/entries/entry-big`, {
    method: 'PUT',
    body: opaque(70 * 1024),
  });
  assert.equal(r.status, 413);
});

test('blob lifecycle: put, get, list with timestamp, delete', { skip }, async () => {
  const pair = `it-${Math.random().toString(36).slice(2, 10)}`;
  let r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`, {
    method: 'PUT',
    body: 'Y2lwaGVydGV4dA==',
  });
  assert.equal(r.status, 204);

  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'Y2lwaGVydGV4dA==');

  r = await fetch(`${BASE}/v1/pairs/${pair}/entries`);
  const { entries } = await r.json();
  const ids = entries.map((e) => e.id);
  assert.ok(ids.includes('entry-1'));
  const mine = entries.find((e) => e.id === 'entry-1');
  assert.equal(typeof mine.t, 'number');

  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`);
  assert.equal(r.status, 404);
});

test('malformed ids and unknown routes are refused', { skip }, async () => {
  let r = await fetch(`${BASE}/v1/pairs/bad%20id!/entries`);
  assert.equal(r.status, 400);
  r = await fetch(`${BASE}/v1/nope`);
  assert.equal(r.status, 404);
  r = await fetch(`${BASE}/`);
  assert.equal(r.status, 404);
});

test('rate limiting kicks in per pair id', { skip }, async () => {
  const pair = `rl-${Math.random().toString(36).slice(2, 10)}`;
  let limited = false;
  for (let i = 0; i < 80 && !limited; i++) {
    const r = await fetch(`${BASE}/v1/pairs/${pair}/entries`);
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'expected a 429 within 80 rapid requests');
});
