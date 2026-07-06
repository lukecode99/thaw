// Live integration tests for the thaw-relay Worker.
// Run: RELAY_URL=https://thaw-relay.<subdomain>.workers.dev npm run test:relay
// Skipped entirely when RELAY_URL is not set, so `npm test` stays hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const BASE = process.env.RELAY_URL?.replace(/\/$/, '');
const skip = BASE ? false : 'RELAY_URL not set';

const opaque = (n) => 'A'.repeat(n); // base64-shaped filler
const sid = () => randomBytes(16).toString('hex'); // 32-hex rendezvous id

test('pairing session: first write creates it, both slots exchange, delete', { skip }, async () => {
  const s = sid();
  let r = await fetch(`${BASE}/v1/pairings/${s}/a`, { method: 'PUT', body: 'cGF5bG9hZEE=' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairings/${s}/b`, { method: 'PUT', body: 'cGF5bG9hZEI=' });
  assert.equal(r.status, 204);

  r = await fetch(`${BASE}/v1/pairings/${s}/a`);
  assert.equal(await r.text(), 'cGF5bG9hZEE=');
  r = await fetch(`${BASE}/v1/pairings/${s}/b`);
  assert.equal(await r.text(), 'cGF5bG9hZEI=');

  r = await fetch(`${BASE}/v1/pairings/${s}`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairings/${s}/a`);
  assert.equal(r.status, 404);
});

test('pairing slots are empty until the peer writes', { skip }, async () => {
  const s = sid();
  const r = await fetch(`${BASE}/v1/pairings/${s}/b`);
  assert.equal(r.status, 404);
});

test('malformed session ids are refused', { skip }, async () => {
  let r = await fetch(`${BASE}/v1/pairings/SHORT/a`, { method: 'PUT', body: 'cGF5bG9hZA==' });
  assert.equal(r.status, 400);
  r = await fetch(`${BASE}/v1/pairings/${'z'.repeat(80)}/a`);
  assert.equal(r.status, 400);
});

test('non-opaque payloads are rejected', { skip }, async () => {
  const plaintext = JSON.stringify({ note: 'raw text with spaces — must be refused' });
  const r = await fetch(`${BASE}/v1/pairings/${sid()}/a`, { method: 'PUT', body: plaintext });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'not_opaque');
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
  const mine = entries.find((e) => e.id === 'entry-1');
  assert.ok(mine, 'listed entry');
  assert.equal(typeof mine.t, 'number');

  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`);
  assert.equal(r.status, 404);
});

test('unpair wipes every blob for the pair', { skip }, async () => {
  const pair = `un-${Math.random().toString(36).slice(2, 10)}`;
  for (const id of ['entry-1', 'entry-2', 'entry-3']) {
    const r = await fetch(`${BASE}/v1/pairs/${pair}/entries/${id}`, {
      method: 'PUT',
      body: 'Y2lwaGVydGV4dA==',
    });
    assert.equal(r.status, 204);
  }
  let r = await fetch(`${BASE}/v1/pairs/${pair}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  const { deleted } = await r.json();
  assert.ok(deleted >= 3, `expected >=3 deleted, got ${deleted}`);
  // KV list is eventually consistent; individual reads are the source of truth.
  for (const id of ['entry-1', 'entry-2', 'entry-3']) {
    r = await fetch(`${BASE}/v1/pairs/${pair}/entries/${id}`);
    assert.equal(r.status, 404);
  }
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
