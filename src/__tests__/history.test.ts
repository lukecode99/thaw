import { createMemoryRelay } from '../crypto/relay';
import { emptyAnswers, type EntryAnswers } from '../entries';
import {
  createEncryptedStorage,
  createEntryStore,
  createMemoryStorage,
  type EntryStore,
} from '../entryStore';
import { PATTERNS_FRAMING, previewOf, tagFrequency } from '../history';
import { fetchPartnerSide } from '../reveal';

const ROOT_KEY = 'ab'.repeat(32);
const OTHER_KEY = 'cd'.repeat(32);
const PAIR_ID = 'pair-under-test';
const T0 = 1_700_000_000_000;

function answersAbout(subject: string): EntryAnswers {
  return {
    ...emptyAnswers(),
    happened: `the disagreement about ${subject}`,
    felt: 'brushed aside',
    needed: 'a pause',
    partnerNeeded: 'to be heard',
    differently: 'ask first',
  };
}

function makeStore(backing?: Map<string, string>, key = ROOT_KEY): EntryStore {
  return createEntryStore(createEncryptedStorage(createMemoryStorage(backing ?? new Map()), key));
}

describe('history at rest — encrypted on device', () => {
  test('nothing readable ever touches the storage backend', async () => {
    const backing = new Map<string, string>();
    const store = makeStore(backing);
    await store.saveDraft(answersAbout('the dishwasher'));
    await store.submit(answersAbout('the dishwasher'), 'chores', ROOT_KEY, T0);
    const entry = (await store.listSubmitted())[0];
    await store.submitClosing(entry.id, 'Ask before assuming.', ROOT_KEY, T0 + 1);

    expect(backing.size).toBeGreaterThan(0);
    for (const raw of backing.values()) {
      expect(raw).toMatch(/^[A-Za-z0-9+/=_-]+$/); // sealed, not JSON
      for (const secret of ['dishwasher', 'chores', 'Ask before assuming', 'happened']) {
        expect(raw.includes(secret)).toBe(false);
        const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        expect(decoded.includes(Buffer.from(secret))).toBe(false);
      }
    }
  });

  test('history persists across an app restart', async () => {
    const backing = new Map<string, string>();
    const before = makeStore(backing);
    await before.submit(answersAbout('weekend plans'), 'plans', ROOT_KEY, T0);

    const after = makeStore(backing); // fresh store, same device storage + key
    const history = await after.loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].tag).toBe('plans');
    expect(history[0].mine).toEqual(answersAbout('weekend plans'));
  });

  test('without the pair key the records do not open', async () => {
    const backing = new Map<string, string>();
    await makeStore(backing).submit(answersAbout('money'), 'money', ROOT_KEY, T0);
    const wrongKey = makeStore(backing, OTHER_KEY);
    expect(await wrongKey.loadHistory()).toHaveLength(0);
    expect(await wrongKey.listSubmitted()).toHaveLength(0);
  });
});

describe('patterns view', () => {
  test('tag frequency counts across repairs, most common first', async () => {
    const store = makeStore();
    await store.submit(answersAbout('the budget'), 'money', ROOT_KEY, T0);
    await store.submit(answersAbout('the shopping'), 'money', ROOT_KEY, T0 + 1000);
    await store.submit(answersAbout('the laundry'), 'chores', ROOT_KEY, T0 + 2000);

    const freq = tagFrequency(await store.loadHistory());
    expect(freq).toEqual([
      { tag: 'money', count: 2 },
      { tag: 'chores', count: 1 },
    ]);
  });

  test('the framing line names the 69% figure and frames recurrence as normal', () => {
    // The banned-words sweep in copy-guard.test.ts covers this string too;
    // here we pin what it must say, not what it must avoid.
    expect(PATTERNS_FRAMING).toContain('69%');
    expect(PATTERNS_FRAMING.toLowerCase()).toContain('normal');
    expect(PATTERNS_FRAMING.toLowerCase()).toContain('repair');
  });

  test('previews are one line, never a wall of text', () => {
    const long = answersAbout('a'.repeat(300));
    expect(previewOf(long).length).toBeLessThanOrEqual(64);
    expect(previewOf(long).endsWith('…')).toBe(true);
  });
});

describe('partner side in history', () => {
  test('the revealed side is cached locally and outlives the relay', async () => {
    const relay = createMemoryRelay();
    const alice = makeStore();
    const bob = makeStore();
    const aliceEntry = await alice.submit(answersAbout('the in-laws'), 'family', ROOT_KEY, T0);
    await alice.flushQueue(relay, PAIR_ID);
    await bob.submit(answersAbout('the visit'), 'family', ROOT_KEY, T0 + 1000);
    await bob.flushQueue(relay, PAIR_ID);

    const side = await fetchPartnerSide(relay, PAIR_ID, ROOT_KEY, await alice.ownIds());
    expect(side.status).toBe('present');
    await alice.savePartnerSide(aliceEntry.id, side.entry!, side.closing);

    await relay.deletePair(PAIR_ID); // relay retention ends; history should not care
    const history = await alice.loadHistory();
    expect(history[0].theirs).toEqual(answersAbout('the visit'));
  });
});

describe('deleting a repair', () => {
  test('removes it locally and removes our relay blobs', async () => {
    const relay = createMemoryRelay();
    const store = makeStore();
    const entry = await store.submit(answersAbout('the holiday'), 'plans', ROOT_KEY, T0);
    const closing = await store.submitClosing(entry.id, 'Book it together.', ROOT_KEY, T0 + 1);
    await store.flushQueue(relay, PAIR_ID);
    expect(await relay.getEntry(PAIR_ID, entry.id)).not.toBeNull();
    expect(await relay.getEntry(PAIR_ID, closing.id)).not.toBeNull();

    await store.deleteEntry(entry.id, relay, PAIR_ID);

    expect(await store.loadHistory()).toHaveLength(0);
    expect(await store.listSubmitted()).toHaveLength(0);
    expect(await store.listClosings()).toHaveLength(0);
    expect(await relay.getEntry(PAIR_ID, entry.id)).toBeNull();
    expect(await relay.getEntry(PAIR_ID, closing.id)).toBeNull();
  });
});

describe('nothing analytics-shaped leaves the phone', () => {
  test('no network payload carries plaintext or tags', async () => {
    const relay = createMemoryRelay();
    const store = makeStore();
    const entry = await store.submit(answersAbout('the school run'), 'communication', ROOT_KEY, T0);
    await store.submitClosing(entry.id, 'Swap mornings.', ROOT_KEY, T0 + 1);
    await store.flushQueue(relay, PAIR_ID);

    expect(relay.observed.length).toBeGreaterThan(0);
    for (const payload of relay.observed) {
      expect(payload).toMatch(/^[A-Za-z0-9+/=_-]+$/);
      const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      for (const secret of ['school run', 'communication', 'Swap mornings']) {
        expect(payload.includes(secret)).toBe(false);
        expect(decoded.includes(Buffer.from(secret))).toBe(false);
      }
    }
  });
});
