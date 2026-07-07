# thaw-relay

Ciphertext relay on Cloudflare Workers + KV. It carries sealed blobs between
the two phones of a pair and never sees plaintext or keys — bodies must be
opaque base64/base64url strings (`readOpaque`), and the worker never calls
`request.json()`.

Deploy: `CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx wrangler deploy`
(credentials come from the environment — never committed).

Live checks: `RELAY_URL=https://thaw-relay.<subdomain>.workers.dev node --test relay/integration.test.mjs`

## KV budget — why the layout looks the way it does

The KV free tier allows **1,000 writes/day, 1,000 lists/day, 100k reads/day**.
The app polls (12s reveal poll, 60s Home poll), so the poll path must cost
zero writes and zero lists or a single leftover browser tab blows the daily
tier overnight — which is exactly what happened on 07 Jul 2026 (Cloudflare
usage alert at 50%): the old worker spent a KV `get`+`put` per request on
rate-limit counters and a KV `.list` per entries poll, ~1,440 of each per
client per day on the 60s poll alone.

Current costs per request:

| Path | KV reads | KV writes | KV lists |
|---|---|---|---|
| GET slot entry index (the poll) | 1 | 0 | 0 |
| GET one blob | 1 | 0 | 0 |
| PUT a blob (submit) | 1 | 2 | 0 |
| DELETE a blob | 1 | 2 | 0 |
| Unpair (DELETE pair) | 2 | ≤2 + one per blob | 0 |
| Pairing exchange | ≤1/req | ≤2/PUT | 0 |

Two clients polling continuously (12s + 60s each) cost ≈17k reads/day and
**zero** writes/lists — comfortably inside the 100k read pool, indefinitely.
Writes happen only when someone actually submits, deletes, or pairs.

### The per-slot entry index

`KV.list` is never called. Each device of a pair owns one slot (`a` or `b`,
fixed at pairing), writes its blobs under `blob:<pairId>:<slot>:<entryId>`,
and the worker maintains a relay-authored index of `{id, t}` rows at the
deterministic key `idx:<pairId>:<slot>`. A phone polls its **partner's**
slot index with one read. Only the slot's own device mutates its index, so
the read-modify-write has a single writer (no cross-device race — same-
location read-after-write is consistent in KV). The index holds ids and
timestamps that were already visible to the relay as key names — no new
metadata, and never client payload. Rows older than the 30-day blob TTL are
filtered out so an expired blob cannot signal phantom partner activity.

### In-memory rate limiting — the trade-off

Rate-limit counters (60 req/min per pair/session id) live in isolate memory
instead of KV. Consequences, accepted deliberately:

- The ceiling is per-isolate: a burst spread across N isolates/PoPs can pass
  up to N×60 req/min, and counters reset whenever an isolate is recycled.
- In exchange, an abusive or runaway client costs **zero** KV operations —
  it can no longer exhaust the daily write budget and take pairing/reveal
  down for everyone until midnight UTC.

At this product's scale the limiter is a courtesy brake on accidental loops,
not a security boundary; the KV budget is the resource that actually needs
protecting. If real abuse ever shows up, move to Durable Objects or Workers
Rate Limiting bindings — not back to KV counters.
