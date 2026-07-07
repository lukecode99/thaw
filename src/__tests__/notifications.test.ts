import { createMemoryRelay } from '../crypto/relay';
import { emptyAnswers, type EntryAnswers } from '../entries';
import { createEncryptedStorage, createEntryStore, createMemoryStorage } from '../entryStore';
import {
  deriveSignal,
  PARTNER_POLL_MS,
  presentSignal,
  SIGNAL_COPY,
  type SignalKind,
} from '../notifications';
import { partnerHasWritten } from '../reveal';
import { createSettingsStore, DEFAULT_SETTINGS } from '../settings';
import { POLL_INTERVAL_MS } from '../useReveal';

const ROOT_KEY = 'ab'.repeat(32);
const PAIR_ID = 'pair-under-test';
const T0 = 1_700_000_000_000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;

// A distinctive marker standing in for something a partner actually wrote.
const MARKER = 'the-dishwasher-argument-on-tuesday-night';

function markedAnswers(): EntryAnswers {
  return {
    ...emptyAnswers(),
    happened: MARKER,
    felt: MARKER,
    needed: MARKER,
    partnerNeeded: MARKER,
    differently: MARKER,
  };
}

function makeStore(backing?: Map<string, string>) {
  return createEntryStore(createEncryptedStorage(createMemoryStorage(backing ?? new Map()), ROOT_KEY));
}

describe('poll-only signal transport (docs/privacy-label.md)', () => {
  test('a phone with nothing submitted learns the partner has written — list-only', async () => {
    const relay = createMemoryRelay();
    const alice = makeStore();
    const bob = makeStore();

    expect(await partnerHasWritten(relay, PAIR_ID, await alice.ownIds())).toBe(false);

    await bob.submit(markedAnswers(), 'chores', ROOT_KEY, T0);
    await bob.flushQueue(relay, PAIR_ID);

    expect(await partnerHasWritten(relay, PAIR_ID, await alice.ownIds())).toBe(true);
    // Bob's own blobs never read as partner activity on his phone.
    expect(await partnerHasWritten(relay, PAIR_ID, await bob.ownIds())).toBe(false);
  });

  test('both poll cadences clear the ~5 minute signal budget', () => {
    expect(POLL_INTERVAL_MS).toBeLessThanOrEqual(FIVE_MINUTES_MS);
    expect(PARTNER_POLL_MS).toBeLessThanOrEqual(FIVE_MINUTES_MS);
  });
});

describe('signal derivation', () => {
  const state = (mineSubmitted: boolean, partnerHasWritten: boolean) => ({
    mineSubmitted,
    partnerHasWritten,
  });

  test('partner arriving first raises the write-yours signal', () => {
    expect(deriveSignal(state(false, false), state(false, true))).toBe('partner-wrote');
  });

  test('partner arriving after our submit raises reveal-ready', () => {
    expect(deriveSignal(state(true, false), state(true, true))).toBe('reveal-ready');
  });

  test('our submit completing an already-written pair raises reveal-ready', () => {
    expect(deriveSignal(state(false, true), state(true, true))).toBe('reveal-ready');
  });

  test('an unchanged state never re-signals', () => {
    expect(deriveSignal(state(false, true), state(false, true))).toBeNull();
    expect(deriveSignal(state(true, true), state(true, true))).toBeNull();
    expect(deriveSignal(state(false, false), state(false, false))).toBeNull();
    expect(deriveSignal(state(true, true), state(true, false))).toBeNull();
  });
});

describe('payloads carry zero user content', () => {
  test('the copy is exactly the two fixed strings', () => {
    expect(SIGNAL_COPY['partner-wrote']).toEqual({
      title: 'Your partner has written their side',
      body: 'Write yours to unlock both.',
    });
    expect(SIGNAL_COPY['reveal-ready']).toEqual({
      title: 'Both sides are in',
      body: 'Your reveal is ready.',
    });
  });

  test('end to end: a submitted entry cannot leak into a presented signal', async () => {
    const relay = createMemoryRelay();
    const bob = makeStore();
    await bob.submit(markedAnswers(), 'chores', ROOT_KEY, T0);
    await bob.flushQueue(relay, PAIR_ID);

    const alice = makeStore();
    const before = { mineSubmitted: false, partnerHasWritten: false };
    const after = {
      mineSubmitted: false,
      partnerHasWritten: await partnerHasWritten(relay, PAIR_ID, await alice.ownIds()),
    };

    const presented: string[] = [];
    presentSignal(deriveSignal(before, after), true, (title, body) => {
      presented.push(title, body);
    });

    expect(presented).toEqual([
      SIGNAL_COPY['partner-wrote'].title,
      SIGNAL_COPY['partner-wrote'].body,
    ]);
    for (const text of presented) {
      expect(text.includes(MARKER)).toBe(false);
      expect(text.includes('chores')).toBe(false);
    }
  });

  test('every signal kind renders from the fixed table only', () => {
    for (const kind of Object.keys(SIGNAL_COPY) as SignalKind[]) {
      const shown: string[] = [];
      presentSignal(kind, true, (title, body) => shown.push(title, body));
      expect(shown).toEqual([SIGNAL_COPY[kind].title, SIGNAL_COPY[kind].body]);
    }
  });
});

describe('the settings toggle', () => {
  test('disabled means nothing is presented, for every signal kind', () => {
    const show = jest.fn();
    presentSignal('partner-wrote', false, show);
    presentSignal('reveal-ready', false, show);
    presentSignal(null, false, show);
    presentSignal(null, true, show);
    expect(show).not.toHaveBeenCalled();
  });

  test('signals default to on and the choice persists across restarts', async () => {
    const backing = new Map<string, string>();
    const storage = createEncryptedStorage(createMemoryStorage(backing), ROOT_KEY);

    const store = createSettingsStore(storage);
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.notifications).toBe(true);

    await store.save({ notifications: false });
    const afterRestart = createSettingsStore(
      createEncryptedStorage(createMemoryStorage(backing), ROOT_KEY),
    );
    expect((await afterRestart.load()).notifications).toBe(false);

    // Like everything at rest, the stored preference is sealed, not JSON.
    for (const raw of backing.values()) {
      expect(raw.includes('notifications')).toBe(false);
    }
  });
});
