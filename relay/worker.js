// thaw-relay — ciphertext relay on Cloudflare Workers + KV.
//
// The relay stores ONLY opaque ciphertext strings plus minimal routing
// metadata (pair id, timestamps). It never sees plaintext or key material:
// bodies must be base64/base64url-shaped opaque strings, and anything else
// is rejected. Keys are derived on the phones during pairing and never sent.
//
// Pairing sessions are addressed by a client-derived rendezvous id: both
// phones derive the same 32-hex id from the two pairing codes (via an
// expensive KDF, so the relay cannot cheaply brute-force the codes back out
// of it). First write creates the session; everything expires in 10 minutes.
//
// KV layout:
//   pair:<sid>             pairing session marker        (TTL 10 min)
//   pair:<sid>:a|b         opaque pairing payloads       (TTL 10 min)
//   blob:<pairId>:<entry>  opaque ciphertext entries     (TTL 30 days)
//   rl:<id>:<minute>       rate-limit counters           (TTL 2 min)

const PAIR_TTL = 600; // pairing sessions expire in 10 minutes
const BLOB_TTL = 30 * 86400; // entries expire in 30 days
const MAX_BODY = 64 * 1024; // 64 KiB size cap per payload
const RATE_LIMIT = 60; // requests per minute per pair/session
const OPAQUE = /^[A-Za-z0-9+/=_-]+$/; // opaque strings only — raw text/JSON is rejected
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const SID = /^[a-f0-9]{32,64}$/; // client-derived rendezvous ids

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

async function overLimit(env, id) {
  const bucket = `rl:${id}:${Math.floor(Date.now() / 60000)}`;
  const count = Number((await env.RELAY.get(bucket)) || 0) + 1;
  await env.RELAY.put(bucket, String(count), { expirationTtl: 120 });
  return count > RATE_LIMIT;
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
      if (await overLimit(env, sid)) return json(429, { error: 'rate_limited' });
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

    // --- Unpair: DELETE /v1/pairs/:pairId wipes every blob for the pair ---
    if (p[1] === 'pairs' && p.length === 3 && m === 'DELETE') {
      const pairId = p[2];
      if (!ID.test(pairId)) return json(400, { error: 'bad_pair_id' });
      if (await overLimit(env, pairId)) return json(429, { error: 'rate_limited' });
      let cursor;
      let deleted = 0;
      do {
        const list = await env.RELAY.list({ prefix: `blob:${pairId}:`, limit: 1000, cursor });
        await Promise.all(list.keys.map((k) => env.RELAY.delete(k.name)));
        deleted += list.keys.length;
        cursor = list.list_complete ? undefined : list.cursor;
      } while (cursor);
      return json(200, { deleted });
    }

    // --- Ciphertext blobs: /v1/pairs/:pairId/entries[/:entryId] ---
    if (p[1] === 'pairs' && p[3] === 'entries') {
      const pairId = p[2];
      if (!ID.test(pairId)) return json(400, { error: 'bad_pair_id' });
      if (await overLimit(env, pairId)) return json(429, { error: 'rate_limited' });
      if (m === 'GET' && p.length === 4) {
        const list = await env.RELAY.list({ prefix: `blob:${pairId}:`, limit: 1000 });
        const entries = list.keys.map((k) => ({
          id: k.name.slice(`blob:${pairId}:`.length),
          t: k.metadata?.t ?? null,
        }));
        return json(200, { entries });
      }
      const entryId = p[4];
      if (p.length !== 5 || !ID.test(entryId)) return json(404, { error: 'not_found' });
      const key = `blob:${pairId}:${entryId}`;
      if (m === 'PUT') {
        const body = await readOpaque(request);
        if (body.err) return body.err;
        await env.RELAY.put(key, body.text, {
          expirationTtl: BLOB_TTL,
          metadata: { t: Date.now() },
        });
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
        return new Response(null, { status: 204 });
      }
      return json(405, { error: 'method_not_allowed' });
    }

    return json(404, { error: 'not_found' });
  },
};
