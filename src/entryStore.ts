// Local persistence for repair entries. Everything rests encrypted on the
// device (wrap the backend with createEncryptedStorage); submitting seals an
// entry with the pair key and queues the ciphertext for the relay. Once
// submitted, an entry cannot be changed — there is deliberately no update
// path. Deleting is the one exception: it removes the local record and the
// relay blob together.
import {
  generateEntryId,
  openLocal,
  sealClosing,
  sealEntry,
  sealLocal,
  type ClosingPlaintext,
  type EntryPlaintext,
} from './crypto/entries';
import type { Slot } from './crypto/pairing';
import type { Relay } from './crypto/relay';
import { isComplete, type EntryAnswers, type RepairEntry } from './entries';
import type { HistoryRepair } from './history';

const DRAFT_KEY = 'thaw.draft.v1';
const ENTRIES_KEY = 'thaw.entries.v1';
const CLOSINGS_KEY = 'thaw.closings.v1';
const PARTNER_KEY = 'thaw.partner.v1';

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
  submit(
    answers: EntryAnswers,
    tag: string,
    rootKeyHex: string,
    now: number,
  ): Promise<RepairEntry>;
  /** All submitted entries, newest first. Records are frozen. */
  listSubmitted(): Promise<RepairEntry[]>;
  /** Seal and record the one optional closing line for an entry. */
  submitClosing(entryId: string, text: string, rootKeyHex: string, now: number): Promise<ClosingLine>;
  /** All closing lines written on this device. */
  listClosings(): Promise<ClosingLine[]>;
  /** Cache the partner's revealed side locally so history outlives the relay. */
  savePartnerSide(
    forEntryId: string,
    theirs: EntryPlaintext,
    theirClosing: ClosingPlaintext | null,
  ): Promise<void>;
  /** Past repairs, newest first: our side joined with anything cached. */
  loadHistory(): Promise<HistoryRepair[]>;
  /** Remove a repair everywhere: local records and our relay blobs. */
  deleteEntry(entryId: string, relay: Relay, pairId: string, slot: Slot): Promise<void>;
  /** Every relay id this device has written (entries + closings). */
  ownIds(): Promise<Set<string>>;
  /** Push any not-yet-uploaded ciphertext to the relay. Safe to call anytime. */
  flushQueue(relay: Relay, pairId: string, slot: Slot): Promise<void>;
  /** Whether anything is still waiting to reach the relay. */
  hasQueued(): Promise<boolean>;
}

interface StoredEntry extends RepairEntry {
  blob: string; // the sealed payload queued for / sent to the relay
}

interface StoredClosing extends ClosingLine {
  blob: string;
}

interface StoredPartnerSide {
  forEntryId: string; // our entry this reveal belonged to
  answers: EntryAnswers;
  closing: string | null;
}

export function createEntryStore(storage: KeyValueStorage): EntryStore {
  async function readList<T>(key: string): Promise<T[]> {
    const raw = await storage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  }

  async function writeList<T>(key: string, list: T[]): Promise<void> {
    await storage.setItem(key, JSON.stringify(list));
  }

  const readEntries = () => readList<StoredEntry>(ENTRIES_KEY);
  const readClosings = () => readList<StoredClosing>(CLOSINGS_KEY);
  const readPartnerSides = () => readList<StoredPartnerSide>(PARTNER_KEY);

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

    async submit(answers, tag, rootKeyHex, now) {
      if (!isComplete(answers)) {
        throw new Error('every prompt needs an answer before submitting');
      }
      const entry: StoredEntry = {
        id: generateEntryId(),
        answers,
        tag,
        createdAt: now,
        uploaded: false,
        blob: sealEntry(rootKeyHex, { v: 1, answers, tag, createdAt: now }),
      };
      const entries = await readEntries();
      entries.unshift(entry);
      await writeList(ENTRIES_KEY, entries);
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
      await writeList(CLOSINGS_KEY, closings);
      const { blob: _blob, ...record } = closing;
      return Object.freeze(record);
    },

    async listClosings() {
      return (await readClosings()).map(({ blob: _blob, ...record }) => Object.freeze(record));
    },

    async savePartnerSide(forEntryId, theirs, theirClosing) {
      const sides = await readPartnerSides();
      const record: StoredPartnerSide = {
        forEntryId,
        answers: theirs.answers,
        closing: theirClosing?.text ?? null,
      };
      const existing = sides.findIndex((s) => s.forEntryId === forEntryId);
      if (existing >= 0) sides[existing] = record;
      else sides.unshift(record);
      await writeList(PARTNER_KEY, sides);
    },

    async loadHistory() {
      const closings = await readClosings();
      const sides = await readPartnerSides();
      return (await readEntries()).map((entry) => {
        const side = sides.find((s) => s.forEntryId === entry.id) ?? null;
        return Object.freeze({
          id: entry.id,
          createdAt: entry.createdAt,
          tag: entry.tag,
          mine: entry.answers,
          myClosing: closings.find((c) => c.by === entry.id)?.text ?? null,
          theirs: side?.answers ?? null,
          theirClosing: side?.closing ?? null,
        });
      });
    },

    async deleteEntry(entryId, relay, pairId, slot) {
      const entries = await readEntries();
      const closings = await readClosings();
      const closing = closings.find((c) => c.by === entryId) ?? null;
      try {
        await relay.deleteEntry(pairId, slot, entryId);
        if (closing) await relay.deleteEntry(pairId, slot, closing.id);
      } catch {
        // Offline — the relay copy expires on its own; local removal proceeds.
      }
      await writeList(
        ENTRIES_KEY,
        entries.filter((e) => e.id !== entryId),
      );
      await writeList(
        CLOSINGS_KEY,
        closings.filter((c) => c.by !== entryId),
      );
      await writeList(
        PARTNER_KEY,
        (await readPartnerSides()).filter((s) => s.forEntryId !== entryId),
      );
    },

    async ownIds() {
      const ids = new Set<string>();
      for (const entry of await readEntries()) ids.add(entry.id);
      for (const closing of await readClosings()) ids.add(closing.id);
      return ids;
    },

    async flushQueue(relay, pairId, slot) {
      const entries = await readEntries();
      const closings = await readClosings();
      let entriesChanged = false;
      let closingsChanged = false;
      for (const entry of entries) {
        if (entry.uploaded) continue;
        try {
          await relay.putEntry(pairId, slot, entry.id, entry.blob);
          entry.uploaded = true;
          entriesChanged = true;
        } catch {
          // Still offline — the queue keeps it for the next flush.
        }
      }
      for (const closing of closings) {
        if (closing.uploaded) continue;
        try {
          await relay.putEntry(pairId, slot, closing.id, closing.blob);
          closing.uploaded = true;
          closingsChanged = true;
        } catch {
          // Same deal.
        }
      }
      if (entriesChanged) await writeList(ENTRIES_KEY, entries);
      if (closingsChanged) await writeList(CLOSINGS_KEY, closings);
    },

    async hasQueued() {
      return (
        (await readEntries()).some((entry) => !entry.uploaded) ||
        (await readClosings()).some((closing) => !closing.uploaded)
      );
    },
  };
}

/** Encrypts every value at rest with a key derived from the pair root key.
 *  What actually hits the backend (AsyncStorage / localStorage) is opaque. */
export function createEncryptedStorage(
  inner: KeyValueStorage,
  rootKeyHex: string,
): KeyValueStorage {
  return {
    async getItem(key) {
      const sealed = await inner.getItem(key);
      return sealed === null ? null : openLocal(rootKeyHex, sealed);
    },
    async setItem(key, value) {
      await inner.setItem(key, sealLocal(rootKeyHex, value));
    },
    async removeItem(key) {
      await inner.removeItem(key);
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
