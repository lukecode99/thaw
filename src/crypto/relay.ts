// Thin client for the ciphertext relay. Everything it carries is already
// sealed by src/crypto/pairing.ts — this layer never sees keys or plaintext.
// Entries live under the device's pairing slot: a deterministic per-slot
// index on the relay makes polling a single cheap read (relay/README.md).
import type { Slot } from './pairing';

export interface Relay {
  putPairingPayload(sid: string, slot: Slot, payload: string): Promise<void>;
  getPairingPayload(sid: string, slot: Slot): Promise<string | null>;
  deletePairingSession(sid: string): Promise<void>;
  putEntry(pairId: string, slot: Slot, entryId: string, blob: string): Promise<void>;
  getEntry(pairId: string, slot: Slot, entryId: string): Promise<string | null>;
  listEntries(pairId: string, slot: Slot): Promise<{ id: string; t: number | null }[]>;
  deleteEntry(pairId: string, slot: Slot, entryId: string): Promise<void>;
  deletePair(pairId: string): Promise<void>;
}

export function createHttpRelay(baseUrl: string): Relay {
  const base = baseUrl.replace(/\/$/, '');

  async function call(method: string, path: string, body?: string): Promise<Response> {
    const response = await fetch(`${base}${path}`, { method, body });
    if (!response.ok && response.status !== 404) {
      throw new Error(`relay ${method} ${path}: ${response.status}`);
    }
    return response;
  }

  return {
    async putPairingPayload(sid, slot, payload) {
      await call('PUT', `/v1/pairings/${sid}/${slot}`, payload);
    },
    async getPairingPayload(sid, slot) {
      const r = await call('GET', `/v1/pairings/${sid}/${slot}`);
      return r.status === 404 ? null : r.text();
    },
    async deletePairingSession(sid) {
      await call('DELETE', `/v1/pairings/${sid}`);
    },
    async putEntry(pairId, slot, entryId, blob) {
      await call('PUT', `/v1/pairs/${pairId}/slots/${slot}/entries/${entryId}`, blob);
    },
    async getEntry(pairId, slot, entryId) {
      const r = await call('GET', `/v1/pairs/${pairId}/slots/${slot}/entries/${entryId}`);
      return r.status === 404 ? null : r.text();
    },
    async listEntries(pairId, slot) {
      const r = await call('GET', `/v1/pairs/${pairId}/slots/${slot}/entries`);
      return (await r.json()).entries;
    },
    async deleteEntry(pairId, slot, entryId) {
      await call('DELETE', `/v1/pairs/${pairId}/slots/${slot}/entries/${entryId}`);
    },
    async deletePair(pairId) {
      await call('DELETE', `/v1/pairs/${pairId}`);
    },
  };
}

/**
 * In-memory relay with the live relay's semantics (opaque payloads only,
 * first pairing write creates the session, entries scoped per slot). Used by
 * tests to simulate two clients and to capture exactly what a relay operator
 * would observe.
 */
export function createMemoryRelay(): Relay & { observed: string[] } {
  const store = new Map<string, string>();
  const observed: string[] = [];
  const OPAQUE = /^[A-Za-z0-9+/=_-]+$/;

  const accept = (payload: string): string => {
    if (!OPAQUE.test(payload)) throw new Error('relay rejected non-opaque payload');
    observed.push(payload);
    return payload;
  };

  return {
    observed,
    async putPairingPayload(sid, slot, payload) {
      store.set(`pair:${sid}:${slot}`, accept(payload));
    },
    async getPairingPayload(sid, slot) {
      return store.get(`pair:${sid}:${slot}`) ?? null;
    },
    async deletePairingSession(sid) {
      for (const key of [...store.keys()]) {
        if (key.startsWith(`pair:${sid}`)) store.delete(key);
      }
    },
    async putEntry(pairId, slot, entryId, blob) {
      store.set(`blob:${pairId}:${slot}:${entryId}`, accept(blob));
    },
    async getEntry(pairId, slot, entryId) {
      return store.get(`blob:${pairId}:${slot}:${entryId}`) ?? null;
    },
    async listEntries(pairId, slot) {
      return [...store.keys()]
        .filter((k) => k.startsWith(`blob:${pairId}:${slot}:`))
        .map((k) => ({ id: k.slice(`blob:${pairId}:${slot}:`.length), t: null }));
    },
    async deleteEntry(pairId, slot, entryId) {
      store.delete(`blob:${pairId}:${slot}:${entryId}`);
    },
    async deletePair(pairId) {
      for (const key of [...store.keys()]) {
        if (key.startsWith(`blob:${pairId}:`)) store.delete(key);
      }
    },
  };
}
