// thaw-relay — ciphertext relay on Cloudflare Workers + KV.
//
// The relay stores ONLY opaque ciphertext strings plus minimal routing
// metadata (pair id, slot, timestamps). It never sees plaintext or key
// material: bodies must be base64/base64url-shaped opaque strings, and
// anything else is rejected. Keys are derived on the phones during pairing
// and never sent.
//
// Pairing sessions are addressed by a client-derived rendezvous id: both
// phones derive the same 32-hex id from the two pairing codes (via an
// expensive KDF, so the relay cannot cheaply brute-force the codes back out
// of it). First write creates the session; everything expires in 10 minutes.
//
// KV budget (free tier: 1,000 writes/day, 1,000 lists/day, 100k reads/day):
// the poll path — GET a slot's entry index — costs exactly ONE KV read and
// zero writes and zero lists, so continuous polling draws only on the 100k
// read pool. KV writes happen on mutating requests only (submits, deletes,
// pairing), and KV.list is never called anywhere: each device's entries are
// tracked in a per-pair-per-slot index at a deterministic key. Rate-limit
// counters live in isolate memory, not KV. See relay/README.md.
//
// KV layout:
//   pair:<sid>                    pairing session marker      (TTL 10 min)
//   pair:<sid>:a|b                opaque pairing payloads     (TTL 10 min)
//   blob:<pairId>:<slot>:<entry>  opaque ciphertext entries   (TTL 30 days)
//   idx:<pairId>:<slot>           relay-written entry index   (TTL 30 days)

const PAIR_TTL = 600; // pairing sessions expire in 10 minutes
const BLOB_TTL = 30 * 86400; // entries expire in 30 days
const MAX_BODY = 64 * 1024; // 64 KiB size cap per payload
const RATE_LIMIT = 60; // requests per minute per pair/session, per isolate
const OPAQUE = /^[A-Za-z0-9+/=_-]+$/; // opaque strings only — raw text/JSON is rejected
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const SID = /^[a-f0-9]{32,64}$/; // client-derived rendezvous ids
const SLOT = /^[ab]$/; // each device of a pair owns one slot, fixed at pairing

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

async function readOpaque(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return { err: json(413, { error: 'too_large' }) };
  const text = await request.text();
  if (text.length > MAX_BODY) return { err: json(413, { error: 'too_large' }) };
  if (!text || !OPAQUE.test(text)) return { err: json(400, { error: 'not_opaque' }) };
  return { text };
}

// Rate limiting in isolate memory — zero KV operations. Trade-off (see
// relay/README.md): counters are per-isolate, so the effective ceiling is
// RATE_LIMIT × concurrent isolates and resets when an isolate is recycled.
// A best-effort brake is all this ever was; what in-memory buys is that a
// misbehaving poller can no longer burn the KV write budget just by asking.
const buckets = new Map(); // id -> { minute, count }
function overLimit(id) {
  const minute = Math.floor(Date.now() / 60000);
  const bucket = buckets.get(id);
  if (bucket && bucket.minute === minute) {
    bucket.count += 1;
    return bucket.count > RATE_LIMIT;
  }
  if (buckets.size >= 4096) {
    for (const [key, b] of buckets) if (b.minute !== minute) buckets.delete(key);
  }
  buckets.set(id, { minute, count: 1 });
  return false;
}

// The per-slot entry index: the deterministic key that replaces KV.list on
// the poll path. Only the slot's own device ever mutates its index (each
// device writes exclusively to its pairing slot), so read-modify-write has a
// single writer and no race; the index is relay-authored metadata — ids and
// timestamps that were already visible as key names — never client payload.
async function readIndex(env, pairId, slot) {
  const raw = await env.RELAY.get(`idx:${pairId}:${slot}`);
  if (!raw) return [];
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    return [];
  }
  // Blobs expire on their own TTL; drop index rows whose blob is already gone
  // so a stale id can never signal phantom partner activity.
  const now = Date.now();
  return items.filter((item) => now - item.t < BLOB_TTL * 1000);
}

async function writeIndex(env, pairId, slot, items) {
  const key = `idx:${pairId}:${slot}`;
  if (items.length === 0) {
    await env.RELAY.delete(key);
    return;
  }
  await env.RELAY.put(key, JSON.stringify(items), { expirationTtl: BLOB_TTL });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const p = pathname.split('/').filter(Boolean);
    const m = request.method;

    if (p[0] !== 'v1') return json(404, { error: 'not_found' });

    // --- Pairing sessions: /v1/pairings/:sid[/:slot] ---
    if (p[1] === 'pairings') {
      const sid = p[2];
      if (!sid || !SID.test(sid)) return json(400, { error: 'bad_session_id' });
      if (overLimit(sid)) return json(429, { error: 'rate_limited' });
      if (m === 'DELETE' && p.length === 3) {
        await Promise.all(
          [`pair:${sid}`, `pair:${sid}:a`, `pair:${sid}:b`].map((k) => env.RELAY.delete(k)),
        );
        return new Response(null, { status: 204 });
      }
      const slot = p[3];
      if (p.length !== 4 || (slot !== 'a' && slot !== 'b')) return json(404, { error: 'not_found' });
      if (m === 'PUT') {
        // First write creates the session; both marker and payloads share the
        // 10-minute window, so nothing pairing-related outlives it.
        const body = await readOpaque(request);
        if (body.err) return body.err;
        if (!(await env.RELAY.get(`pair:${sid}`))) {
          await env.RELAY.put(`pair:${sid}`, '1', { expirationTtl: PAIR_TTL });
        }
        await env.RELAY.put(`pair:${sid}:${slot}`, body.text, { expirationTtl: PAIR_TTL });
        return new Response(null, { status: 204 });
      }
      if (m === 'GET') {
        const payload = await env.RELAY.get(`pair:${sid}:${slot}`);
        return payload === null
          ? json(404, { error: 'not_found' })
          : new Response(payload, { headers: { 'content-type': 'text/plain' } });
      }
      return json(405, { error: 'method_not_allowed' });
    }

    // --- Unpair: DELETE /v1/pairs/:pairId wipes every blob for the pair.
    // Both slot indexes name every live blob, so no KV.list is needed.
    if (p[1] === 'pairs' && p.length === 3 && m === 'DELETE') {
      const pairId = p[2];
      if (!ID.test(pairId)) return json(400, { error: 'bad_pair_id' });
      if (overLimit(pairId)) return json(429, { error: 'rate_limited' });
      let deleted = 0;
      for (const slot of ['a', 'b']) {
        const items = await readIndex(env, pairId, slot);
        await Promise.all(
          items.map((item) => env.RELAY.delete(`blob:${pairId}:${slot}:${item.id}`)),
        );
        deleted += items.length;
        await env.RELAY.delete(`idx:${pairId}:${slot}`);
      }
      return json(200, { deleted });
    }

    // --- Ciphertext blobs: /v1/pairs/:pairId/slots/:slot/entries[/:entryId] ---
    if (p[1] === 'pairs' && p[3] === 'slots' && p[5] === 'entries') {
      const pairId = p[2];
      const slot = p[4];
      if (!ID.test(pairId)) return json(400, { error: 'bad_pair_id' });
      if (!SLOT.test(slot)) return json(400, { error: 'bad_slot' });
      if (overLimit(pairId)) return json(429, { error: 'rate_limited' });

      // The poll path: exactly one KV read, zero writes, zero lists.
      if (m === 'GET' && p.length === 6) {
        const entries = await readIndex(env, pairId, slot);
        return json(200, { entries });
      }

      const entryId = p[6];
      if (p.length !== 7 || !ID.test(entryId)) return json(404, { error: 'not_found' });
      const key = `blob:${pairId}:${slot}:${entryId}`;
      if (m === 'PUT') {
        const body = await readOpaque(request);
        if (body.err) return body.err;
        await env.RELAY.put(key, body.text, { expirationTtl: BLOB_TTL });
        const items = (await readIndex(env, pairId, slot)).filter((item) => item.id !== entryId);
        items.push({ id: entryId, t: Date.now() });
        await writeIndex(env, pairId, slot, items);
        return new Response(null, { status: 204 });
      }
      if (m === 'GET') {
        const blob = await env.RELAY.get(key);
        return blob === null
          ? json(404, { error: 'not_found' })
          : new Response(blob, { headers: { 'content-type': 'text/plain' } });
      }
      if (m === 'DELETE') {
        await env.RELAY.delete(key);
        const items = (await readIndex(env, pairId, slot)).filter((item) => item.id !== entryId);
        await writeIndex(env, pairId, slot, items);
        return new Response(null, { status: 204 });
      }
      return json(405, { error: 'method_not_allowed' });
    }

    return json(404, { error: 'not_found' });
  },
};
