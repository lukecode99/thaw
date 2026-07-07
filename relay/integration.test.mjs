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
  const r = await fetch(`${BASE}/v1/pairs/pair-size-test/slots/a/entries/entry-big`, {
    method: 'PUT',
    body: opaque(70 * 1024),
  });
  assert.equal(r.status, 413);
});

test('blob lifecycle: put, get, poll index with timestamp, delete', { skip }, async () => {
  const pair = `it-${Math.random().toString(36).slice(2, 10)}`;
  let r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries/entry-1`, {
    method: 'PUT',
    body: 'Y2lwaGVydGV4dA==',
  });
  assert.equal(r.status, 204);

  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries/entry-1`);
  assert.equal(r.status, 200);
  assert.equal(await r.text(), 'Y2lwaGVydGV4dA==');

  // The poll: one read of the slot's index — the blob shows with a timestamp.
  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries`);
  const { entries } = await r.json();
  const mine = entries.find((e) => e.id === 'entry-1');
  assert.ok(mine, 'indexed entry');
  assert.equal(typeof mine.t, 'number');

  // The other slot's index stays empty — devices only ever see the partner's
  // slot fill up when the partner actually writes.
  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/b/entries`);
  assert.deepEqual((await r.json()).entries, []);

  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries/entry-1`, { method: 'DELETE' });
  assert.equal(r.status, 204);
  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries/entry-1`);
  assert.equal(r.status, 404);
  r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries`);
  assert.deepEqual((await r.json()).entries, []);
});

test('unpair wipes every blob for the pair, across both slots', { skip }, async () => {
  const pair = `un-${Math.random().toString(36).slice(2, 10)}`;
  for (const [slot, id] of [['a', 'entry-1'], ['a', 'entry-2'], ['b', 'entry-3']]) {
    const r = await fetch(`${BASE}/v1/pairs/${pair}/slots/${slot}/entries/${id}`, {
      method: 'PUT',
      body: 'Y2lwaGVydGV4dA==',
    });
    assert.equal(r.status, 204);
  }
  let r = await fetch(`${BASE}/v1/pairs/${pair}`, { method: 'DELETE' });
  assert.equal(r.status, 200);
  const { deleted } = await r.json();
  assert.ok(deleted >= 3, `expected >=3 deleted, got ${deleted}`);
  for (const [slot, id] of [['a', 'entry-1'], ['a', 'entry-2'], ['b', 'entry-3']]) {
    r = await fetch(`${BASE}/v1/pairs/${pair}/slots/${slot}/entries/${id}`);
    assert.equal(r.status, 404);
  }
});

test('malformed ids, bad slots, and unknown routes are refused', { skip }, async () => {
  let r = await fetch(`${BASE}/v1/pairs/bad%20id!/slots/a/entries`);
  assert.equal(r.status, 400);
  r = await fetch(`${BASE}/v1/pairs/pair-ok/slots/c/entries`);
  assert.equal(r.status, 400);
  r = await fetch(`${BASE}/v1/nope`);
  assert.equal(r.status, 404);
  r = await fetch(`${BASE}/`);
  assert.equal(r.status, 404);
});

test('the retired list routes are gone — stale clients get 404s, not KV lists', { skip }, async () => {
  const pair = `old-${Math.random().toString(36).slice(2, 10)}`;
  let r = await fetch(`${BASE}/v1/pairs/${pair}/entries`);
  assert.equal(r.status, 404);
  r = await fetch(`${BASE}/v1/pairs/${pair}/entries/entry-1`, {
    method: 'PUT',
    body: 'Y2lwaGVydGV4dA==',
  });
  assert.equal(r.status, 404);
});

test('rate limiting kicks in per pair id', { skip }, async () => {
  // Counters are per-isolate, so a sequential burst has to exhaust every
  // isolate it lands on before a 429 shows (observed: ~2 isolates → first
  // 429 at request 121). 300 covers a handful of isolates.
  const pair = `rl-${Math.random().toString(36).slice(2, 10)}`;
  let limited = false;
  for (let i = 0; i < 300 && !limited; i++) {
    const r = await fetch(`${BASE}/v1/pairs/${pair}/slots/a/entries`);
    if (r.status === 429) limited = true;
  }
  assert.ok(limited, 'expected a 429 within 300 rapid requests');
});
