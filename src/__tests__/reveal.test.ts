import { createMemoryRelay } from '../crypto/relay';
import { emptyAnswers, type EntryAnswers } from '../entries';
import { createEntryStore, createMemoryStorage, type EntryStore } from '../entryStore';
import { deriveReveal, fetchPartnerSide, type PartnerSide } from '../reveal';

const ALICE_KEY = 'ab'.repeat(32);
const PAIR_ID = 'pair-under-test';
const T0 = 1_700_000_000_000;

const NOTHING: PartnerSide = { status: 'none', entry: null, closing: null };

function answersFrom(author: string): EntryAnswers {
  return {
    ...emptyAnswers(),
    happened: `${author}: the argument about the weekend`,
    felt: `${author}: rushed past`,
    needed: `${author}: ten quiet minutes`,
    partnerNeeded: `${author}: probably the same`,
    differently: `${author}: pause before answering`,
  };
}

/** Both partners share the root key; each has their own device store. */
function makeClient(): EntryStore {
  return createEntryStore(createMemoryStorage());
}

describe('reveal gating — impossible until both submitted', () => {
  test('no entry on this phone → no reveal state at all', () => {
    expect(deriveReveal(null, NOTHING, null).phase).toBe('no-entry');
  });

  test('own entry sealed, partner pending → waiting, own entry intact', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    const mine = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID, 'a');

    const partner = await fetchPartnerSide(relay, PAIR_ID, 'b', ALICE_KEY, await alice.ownIds());
    expect(partner.status).toBe('none');

    const reveal = deriveReveal(mine, partner, null);
    expect(reveal.phase).toBe('waiting');
    if (reveal.phase === 'waiting') expect(reveal.mine.answers).toEqual(answersFrom('alice'));
  });

  test('both submitted → ready, each sees the other side prompt-aligned', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    const bob = makeClient();

    const aliceEntry = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID, 'a');
    const bobEntry = await bob.submit(answersFrom('bob'), 'money', ALICE_KEY, T0 + 1000);
    await bob.flushQueue(relay, PAIR_ID, 'b');

    const forAlice = await fetchPartnerSide(relay, PAIR_ID, 'b', ALICE_KEY, await alice.ownIds());
    const forBob = await fetchPartnerSide(relay, PAIR_ID, 'a', ALICE_KEY, await bob.ownIds());

    const aliceReveal = deriveReveal(aliceEntry, forAlice, null);
    const bobReveal = deriveReveal(bobEntry, forBob, null);
    expect(aliceReveal.phase).toBe('ready');
    expect(bobReveal.phase).toBe('ready');
    if (aliceReveal.phase === 'ready' && bobReveal.phase === 'ready') {
      expect(aliceReveal.theirs.answers).toEqual(answersFrom('bob'));
      expect(bobReveal.theirs.answers).toEqual(answersFrom('alice'));
    }
  });

  test('what the relay holds before the reveal is unreadable ciphertext', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID, 'a');

    for (const payload of relay.observed) {
      expect(payload).toMatch(/^[A-Za-z0-9+/=_-]+$/);
      const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      expect(decoded.includes(Buffer.from('the argument about the weekend'))).toBe(false);
    }
  });
});

describe('closing lines', () => {
  test('both closing lines sync and render on both phones', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    const bob = makeClient();

    const aliceEntry = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    const bobEntry = await bob.submit(answersFrom('bob'), 'money', ALICE_KEY, T0 + 1000);
    await alice.flushQueue(relay, PAIR_ID, 'a');
    await bob.flushQueue(relay, PAIR_ID, 'b');

    await alice.submitClosing(aliceEntry.id, 'I want to ask before assuming.', ALICE_KEY, T0 + 2000);
    await bob.submitClosing(bobEntry.id, 'Ten minutes first, next time.', ALICE_KEY, T0 + 3000);
    await alice.flushQueue(relay, PAIR_ID, 'a');
    await bob.flushQueue(relay, PAIR_ID, 'b');

    const forAlice = await fetchPartnerSide(relay, PAIR_ID, 'b', ALICE_KEY, await alice.ownIds());
    const forBob = await fetchPartnerSide(relay, PAIR_ID, 'a', ALICE_KEY, await bob.ownIds());

    const aliceMyClosing = (await alice.listClosings()).find((c) => c.by === aliceEntry.id)!.text;
    const aliceReveal = deriveReveal(aliceEntry, forAlice, aliceMyClosing);
    expect(aliceReveal.phase).toBe('ready');
    if (aliceReveal.phase === 'ready') {
      expect(aliceReveal.myClosing).toBe('I want to ask before assuming.');
      expect(aliceReveal.theirClosing).toBe('Ten minutes first, next time.');
    }

    const bobReveal = deriveReveal(bobEntry, forBob, null);
    if (bobReveal.phase === 'ready') {
      expect(bobReveal.theirClosing).toBe('I want to ask before assuming.');
    }

    // Closing text is sealed too — never readable on the relay.
    for (const payload of relay.observed) {
      const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      expect(decoded.includes(Buffer.from('Ten minutes first'))).toBe(false);
    }
  });

  test('one closing line per entry, and it needs actual words', async () => {
    const alice = makeClient();
    const entry = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await expect(alice.submitClosing(entry.id, '   ', ALICE_KEY, T0)).rejects.toThrow();
    await alice.submitClosing(entry.id, 'Once.', ALICE_KEY, T0);
    await expect(alice.submitClosing(entry.id, 'Twice.', ALICE_KEY, T0)).rejects.toThrow();
  });
});

describe('decrypt failure — graceful, never destructive', () => {
  test('a blob that will not open is retried, reported, and nothing is lost', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    const mine = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID, 'a');

    // Something lands under the pair that no key opens (opaque garbage).
    await relay.putEntry(PAIR_ID, 'b', 'garbage-blob', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

    let gets = 0;
    const counting = {
      ...relay,
      getEntry: async (pairId: string, slot: 'a' | 'b', id: string) => {
        if (id === 'garbage-blob') gets += 1;
        return relay.getEntry(pairId, slot, id);
      },
    };

    const partner = await fetchPartnerSide(counting, PAIR_ID, 'b', ALICE_KEY, await alice.ownIds());
    expect(gets).toBe(2); // fetched, failed to open, re-fetched once
    expect(partner.status).toBe('trouble');
    expect(deriveReveal(mine, partner, null).phase).toBe('trouble');

    // Never data loss: nothing was deleted anywhere.
    expect(await relay.getEntry(PAIR_ID, 'b', 'garbage-blob')).not.toBeNull();
    expect((await alice.listSubmitted())[0].answers).toEqual(answersFrom('alice'));
  });

  test('a stray unreadable blob does not block the reveal once a good entry arrives', async () => {
    const relay = createMemoryRelay();
    const alice = makeClient();
    const bob = makeClient();
    const mine = await alice.submit(answersFrom('alice'), 'money', ALICE_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID, 'a');
    await relay.putEntry(PAIR_ID, 'b', 'garbage-blob', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    await bob.submit(answersFrom('bob'), 'money', ALICE_KEY, T0 + 1000);
    await bob.flushQueue(relay, PAIR_ID, 'b');

    const partner = await fetchPartnerSide(relay, PAIR_ID, 'b', ALICE_KEY, await alice.ownIds());
    expect(partner.status).toBe('present');
    expect(deriveReveal(mine, partner, null).phase).toBe('ready');
  });
});
