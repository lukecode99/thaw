// Local persistence for repair entries. Drafts live unencrypted on the
// device only (never uploaded); submitting seals the entry, locks it, and
// queues the ciphertext for the relay. Once submitted, an entry cannot be
// changed — there is deliberately no update path.
import { generateEntryId, sealClosing, sealEntry } from './crypto/entries';
import type { Relay } from './crypto/relay';
import { isComplete, type EntryAnswers, type RepairEntry } from './entries';

const DRAFT_KEY = 'thaw.draft.v1';
const ENTRIES_KEY = 'thaw.entries.v1';
const CLOSINGS_KEY = 'thaw.closings.v1';

export interface ClosingLine {
  id: string; // relay id of the sealed closing blob
  by: string; // id of the entry it closes
  text: string;
  createdAt: number;
  uploaded: boolean;
}

/** Minimal async key-value backend (AsyncStorage-shaped). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface EntryStore {
  loadDraft(): Promise<EntryAnswers | null>;
  saveDraft(answers: EntryAnswers): Promise<void>;
  clearDraft(): Promise<void>;
  /** Seal, lock and locally record a completed set of answers. */
  submit(answers: EntryAnswers, rootKeyHex: string, now: number): Promise<RepairEntry>;
  /** All submitted entries, newest first. Records are frozen. */
  listSubmitted(): Promise<RepairEntry[]>;
  /** Seal and record the one optional closing line for an entry. */
  submitClosing(entryId: string, text: string, rootKeyHex: string, now: number): Promise<ClosingLine>;
  /** All closing lines written on this device. */
  listClosings(): Promise<ClosingLine[]>;
  /** Every relay id this device has written (entries + closings). */
  ownIds(): Promise<Set<string>>;
  /** Push any not-yet-uploaded ciphertext to the relay. Safe to call anytime. */
  flushQueue(relay: Relay, pairId: string): Promise<void>;
  /** Whether anything is still waiting to reach the relay. */
  hasQueued(): Promise<boolean>;
}

interface StoredEntry extends RepairEntry {
  blob: string; // the sealed payload queued for / sent to the relay
}

interface StoredClosing extends ClosingLine {
  blob: string;
}

export function createEntryStore(storage: KeyValueStorage): EntryStore {
  async function readEntries(): Promise<StoredEntry[]> {
    const raw = await storage.getItem(ENTRIES_KEY);
    return raw ? (JSON.parse(raw) as StoredEntry[]) : [];
  }

  async function writeEntries(entries: StoredEntry[]): Promise<void> {
    await storage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }

  async function readClosings(): Promise<StoredClosing[]> {
    const raw = await storage.getItem(CLOSINGS_KEY);
    return raw ? (JSON.parse(raw) as StoredClosing[]) : [];
  }

  async function writeClosings(closings: StoredClosing[]): Promise<void> {
    await storage.setItem(CLOSINGS_KEY, JSON.stringify(closings));
  }

  return {
    async loadDraft() {
      const raw = await storage.getItem(DRAFT_KEY);
      return raw ? (JSON.parse(raw) as EntryAnswers) : null;
    },
    async saveDraft(answers) {
      await storage.setItem(DRAFT_KEY, JSON.stringify(answers));
    },
    async clearDraft() {
      await storage.removeItem(DRAFT_KEY);
    },

    async submit(answers, rootKeyHex, now) {
      if (!isComplete(answers)) {
        throw new Error('every prompt needs an answer before submitting');
      }
      const entry: StoredEntry = {
        id: generateEntryId(),
        answers,
        createdAt: now,
        uploaded: false,
        blob: sealEntry(rootKeyHex, { v: 1, answers, createdAt: now }),
      };
      const entries = await readEntries();
      entries.unshift(entry);
      await writeEntries(entries);
      await storage.removeItem(DRAFT_KEY);
      const { blob: _blob, ...record } = entry;
      return Object.freeze(record);
    },

    async listSubmitted() {
      return (await readEntries()).map(({ blob: _blob, ...record }) => Object.freeze(record));
    },

    async submitClosing(entryId, text, rootKeyHex, now) {
      const line = text.trim();
      if (!line) throw new Error('a closing line needs a few words');
      const closings = await readClosings();
      if (closings.some((c) => c.by === entryId)) {
        throw new Error('this entry already has its closing line');
      }
      const closing: StoredClosing = {
        id: generateEntryId(),
        by: entryId,
        text: line,
        createdAt: now,
        uploaded: false,
        blob: sealClosing(rootKeyHex, { by: entryId, text: line, createdAt: now }),
      };
      closings.unshift(closing);
      await writeClosings(closings);
      const { blob: _blob, ...record } = closing;
      return Object.freeze(record);
    },

    async listClosings() {
      return (await readClosings()).map(({ blob: _blob, ...record }) => Object.freeze(record));
    },

    async ownIds() {
      const ids = new Set<string>();
      for (const entry of await readEntries()) ids.add(entry.id);
      for (const closing of await readClosings()) ids.add(closing.id);
      return ids;
    },

    async flushQueue(relay, pairId) {
      const entries = await readEntries();
      const closings = await readClosings();
      let entriesChanged = false;
      let closingsChanged = false;
      for (const entry of entries) {
        if (entry.uploaded) continue;
        try {
          await relay.putEntry(pairId, entry.id, entry.blob);
          entry.uploaded = true;
          entriesChanged = true;
        } catch {
          // Still offline — the queue keeps it for the next flush.
        }
      }
      for (const closing of closings) {
        if (closing.uploaded) continue;
        try {
          await relay.putEntry(pairId, closing.id, closing.blob);
          closing.uploaded = true;
          closingsChanged = true;
        } catch {
          // Same deal.
        }
      }
      if (entriesChanged) await writeEntries(entries);
      if (closingsChanged) await writeClosings(closings);
    },

    async hasQueued() {
      return (
        (await readEntries()).some((entry) => !entry.uploaded) ||
        (await readClosings()).some((closing) => !closing.uploaded)
      );
    },
  };
}

/** Backed by AsyncStorage on device; falls back to localStorage on web. */
export function createDeviceStorage(): KeyValueStorage {
  async function backend(): Promise<KeyValueStorage> {
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      return mod.default;
    } catch {
      return {
        async getItem(key) {
          return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
        },
        async setItem(key, value) {
          if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
        },
        async removeItem(key) {
          if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        },
      };
    }
  }
  return {
    getItem: async (key) => (await backend()).getItem(key),
    setItem: async (key, value) => (await backend()).setItem(key, value),
    removeItem: async (key) => (await backend()).removeItem(key),
  };
}

/** In-memory backend for tests; share the map to simulate an app restart. */
export function createMemoryStorage(
  backing: Map<string, string> = new Map(),
): KeyValueStorage & { backing: Map<string, string> } {
  return {
    backing,
    async getItem(key) {
      return backing.get(key) ?? null;
    },
    async setItem(key, value) {
      backing.set(key, value);
    },
    async removeItem(key) {
      backing.delete(key);
    },
  };
}
