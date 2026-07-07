import { openEntry } from '../crypto/entries';
import { createMemoryRelay } from '../crypto/relay';
import {
  emptyAnswers,
  isComplete,
  missingAnswers,
  PROMPTS,
  type EntryAnswers,
} from '../entries';
import { createEntryStore, createMemoryStorage } from '../entryStore';

const ROOT_KEY = 'ab'.repeat(32);
const OTHER_KEY = 'cd'.repeat(32);
const PAIR_ID = 'pair-under-test';
const T0 = 1_700_000_000_000;

function filledAnswers(): EntryAnswers {
  return {
    happened: 'I snapped about the dishes before you had even put your bag down.',
    felt: 'Invisible, like the evening only worked if I carried it.',
    needed: 'A minute together before the chores conversation.',
    partnerNeeded: 'To land after a hard day before being handed a task.',
    differently: 'Ask how your day was first.',
  };
}

describe('submitted entries reach the relay as ciphertext only', () => {
  test('the stored blob is opaque and decodes to nothing readable', async () => {
    const relay = createMemoryRelay();
    const store = createEntryStore(createMemoryStorage());
    const answers = filledAnswers();

    await store.submit(answers, 'chores', ROOT_KEY, T0);
    await store.flushQueue(relay, PAIR_ID);

    expect(relay.observed.length).toBe(1);
    const blob = relay.observed[0];
    expect(blob).toMatch(/^[A-Za-z0-9+/=_-]+$/);

    // Decode what the relay stores and assert it is unreadable: no answer
    // text survives in the raw bytes, and it is not parseable JSON.
    const raw = Buffer.from(blob.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const decoded = raw.toString('utf8');
    for (const answer of Object.values(answers)) {
      expect(decoded).not.toContain(answer);
      expect(raw.includes(Buffer.from(answer, 'utf8'))).toBe(false);
    }
    expect(() => JSON.parse(decoded)).toThrow();

    // Only the pair key opens it — and it round-trips exactly.
    expect(openEntry(ROOT_KEY, blob)?.answers).toEqual(answers);
    expect(openEntry(OTHER_KEY, blob)).toBeNull();
  });

  test('a tampered blob refuses to open', async () => {
    const relay = createMemoryRelay();
    const store = createEntryStore(createMemoryStorage());
    await store.submit(filledAnswers(), 'chores', ROOT_KEY, T0);
    await store.flushQueue(relay, PAIR_ID);

    const blob = relay.observed[0];
    const flipped = (blob[40] === 'A' ? 'B' : 'A') + blob.slice(1);
    expect(openEntry(ROOT_KEY, flipped.slice(0, blob.length))).toBeNull();
  });
});

describe('entries are immutable after submit', () => {
  test('submitted records are frozen and the store has no update path', async () => {
    const store = createEntryStore(createMemoryStorage());
    const record = await store.submit(filledAnswers(), 'chores', ROOT_KEY, T0);

    expect(Object.isFrozen(record)).toBe(true);
    expect(() => {
      'use strict';
      (record as { createdAt: number }).createdAt = 0;
    }).toThrow();

    const listed = await store.listSubmitted();
    expect(Object.isFrozen(listed[0])).toBe(true);
    expect(Object.keys(store)).not.toEqual(expect.arrayContaining(['updateEntry']));
  });

  test('later drafting never touches a submitted entry', async () => {
    const store = createEntryStore(createMemoryStorage());
    const original = filledAnswers();
    await store.submit(original, 'chores', ROOT_KEY, T0);

    await store.saveDraft({ ...emptyAnswers(), happened: 'a brand new draft' });
    const [entry] = await store.listSubmitted();
    expect(entry.answers).toEqual(original);
  });

  test('submit clears the draft so the sealed text cannot be re-edited', async () => {
    const store = createEntryStore(createMemoryStorage());
    await store.saveDraft(filledAnswers());
    await store.submit(filledAnswers(), 'chores', ROOT_KEY, T0);
    expect(await store.loadDraft()).toBeNull();
  });
});

describe('drafts', () => {
  test('a draft survives an app restart', async () => {
    const backing = new Map<string, string>();
    const before = createEntryStore(createMemoryStorage(backing));
    const draft = { ...emptyAnswers(), happened: 'still thinking about this one' };
    await before.saveDraft(draft);

    // A new store over the same backing is a fresh app launch.
    const after = createEntryStore(createMemoryStorage(backing));
    expect(await after.loadDraft()).toEqual(draft);
  });

  test('submitted entries also survive a restart', async () => {
    const backing = new Map<string, string>();
    const before = createEntryStore(createMemoryStorage(backing));
    await before.submit(filledAnswers(), 'chores', ROOT_KEY, T0);

    const after = createEntryStore(createMemoryStorage(backing));
    const [entry] = await after.listSubmitted();
    expect(entry.answers).toEqual(filledAnswers());
  });
});

describe('validation', () => {
  test('every prompt must have an answer before submit', async () => {
    const store = createEntryStore(createMemoryStorage());
    const partial = { ...filledAnswers(), needed: '   ' };
    expect(missingAnswers(partial)).toEqual(['needed']);
    expect(isComplete(partial)).toBe(false);
    await expect(store.submit(partial, 'chores', ROOT_KEY, T0)).rejects.toThrow();
    expect(await store.listSubmitted()).toEqual([]);
  });

  test('empty answers report all five prompts missing', () => {
    expect(missingAnswers(emptyAnswers())).toHaveLength(5);
    expect(isComplete(filledAnswers())).toBe(true);
  });
});

describe('the five prompts match the spec', () => {
  test('prompt wording covers the five repair questions in order', () => {
    expect(PROMPTS).toHaveLength(5);
    const titles = PROMPTS.map((p) => p.title);
    expect(titles[0]).toMatch(/what happened/i);
    expect(PROMPTS[0].hint).toMatch(/one sentence/i);
    expect(titles[1]).toMatch(/what did you feel/i);
    expect(titles[2]).toMatch(/what did you need/i);
    expect(titles[3]).toMatch(/partner need/i);
    expect(titles[4]).toMatch(/differently/i);
  });
});

describe('offline drafting and upload queue', () => {
  test('a submit while offline is kept locally and uploaded on the next flush', async () => {
    const store = createEntryStore(createMemoryStorage());
    const relay = createMemoryRelay();
    let online = false;
    const flakyRelay = {
      ...relay,
      putEntry: async (pairId: string, entryId: string, blob: string) => {
        if (!online) throw new Error('offline');
        return relay.putEntry(pairId, entryId, blob);
      },
    };

    await store.submit(filledAnswers(), 'chores', ROOT_KEY, T0);
    await store.flushQueue(flakyRelay, PAIR_ID);

    // Offline: the entry exists locally, marked as still queued.
    expect(await store.hasQueued()).toBe(true);
    const [entry] = await store.listSubmitted();
    expect(entry.uploaded).toBe(false);
    expect(await relay.listEntries(PAIR_ID)).toEqual([]);

    // Back online: the queue drains and the ciphertext lands on the relay.
    online = true;
    await store.flushQueue(flakyRelay, PAIR_ID);
    expect(await store.hasQueued()).toBe(false);
    expect((await store.listSubmitted())[0].uploaded).toBe(true);
    expect(await relay.listEntries(PAIR_ID)).toHaveLength(1);
  });
});
