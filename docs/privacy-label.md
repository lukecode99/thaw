# Decision note: partner signals vs. the App Store privacy label

**Decision: poll-only (option b). No push tokens anywhere in the system.**

Status: accepted · 7 Jul 2026 · Revisit trigger below.

## The problem

The partner needs two signals, with fixed wording and zero user content:

1. **Submit** — "Your partner has written their side — write yours to unlock both."
2. **Reveal-ready** — "Both sides are in — your reveal is ready."

The obvious design is Expo push. But our App Store privacy label — **"Data Not
Collected"** — is the product's headline marketing asset, and a push token is a
claim-breaker for it.

## Options evaluated

### (a) Expo push notifications

Each device registers an APNs/FCM token via Expo and we store it server-side to
address the device later. Under Apple's definitions, data is "collected" when it
is transmitted off the device in a way that outlives the request. A push token
is exactly that: a durable, device-scoped identifier held by our backend and by
Expo's push service. The label would have to declare **Identifiers → Device ID,
collected**, and Expo becomes a third-party processor we'd need to describe in
the privacy policy. "Data Not Collected" is gone — for the whole app, over one
convenience feature.

Delivery quality: excellent (seconds, app closed or open).

### (b) Poll-only — chosen

The app asks the relay "is there a blob under this pair that I didn't write?"
using the existing list endpoint. List responses carry opaque blob ids only —
no payloads are fetched and nothing is decrypted by the check. The relay learns
nothing new: it already sees the pair id and requester IP transiently whenever
the app syncs ciphertext, and that is disclosable as not-collected because
nothing is retained or linked. No tokens, no identifiers, no third parties.
**The label stays "Data Not Collected."**

Delivery quality: see the latency section — this is the honest cost.

### (c) Push token held only in the relay KV pair record

Same token, different shelf. The token still leaves the device and is stored
server-side, keyed to the pair, for longer than the request that carried it —
that is "collected" under Apple's definition regardless of which database row
it sits in. It also quietly upgrades the relay from "ciphertext with random
ids" to "ciphertext plus a routable device identifier," which weakens the
we-cannot-know-who-you-are story. All of (a)'s label cost, none of its
delivery guarantees being better. Rejected.

## The honest latency trade-off

What "poll-only" actually delivers, stated plainly so it can be overruled with
eyes open:

| Situation | Signal latency |
|---|---|
| App open, a repair in flight (waiting on partner) | ≤ 12 s (reveal poll) |
| App open on Home, nothing submitted on this phone | ≤ 60 s (partner-activity poll) |
| App backgrounded (native builds) | OS-scheduled background refresh: opportunistic, typically minutes to hours, **not guaranteed** |
| App fully closed / force-quit | No signal until next open |

The success criterion ("signals within ~5 min") is met whenever the app is
running — 12 s and 60 s both clear it with room. The gap is the closed-app
case: with push, a partner who hasn't opened the app still gets a banner within
seconds; with poll-only, they find out when they next open it. For a two-person
app whose core moment is deliberate ("find a quiet moment and open it
together"), we judge that acceptable at launch — but it is a real
retention risk if data later shows partners missing reveals for days.

Native builds (CR-9) should register a background-refresh task that runs the
same list-only check; that narrows the backgrounded case without touching the
label, since the check is client-initiated and tokenless. It cannot fix the
force-quit case — only push can.

## What is implemented

- List-only partner-activity poll on Home (60 s) when nothing is submitted on
  this phone; the existing 12 s reveal poll covers the in-flight case.
- Signals are pure functions of two booleans per side (`mineSubmitted`,
  `partnerHasWritten`) — user content cannot flow into a payload by
  construction, and tests assert the copy is exactly the fixed strings.
- Device-level banner on web via the browser Notification API (only when
  permission is already granted and the tab is hidden); in-app cards carry the
  same information everywhere.
- Settings toggle ("Partner signals") that suppresses all signal presentation;
  persisted encrypted at rest like everything else.

## Revisit trigger

If post-launch data shows the closed-app gap materially hurting completion
(pairs where one side submits and the other doesn't open the app within, say,
48 h), revisit option (a) **as an explicit opt-in**: notifications off by
default, a settings switch that plainly says turning it on shares a device
token with our notification provider, and the label updated to match. The
default experience keeps the clean label either way.
