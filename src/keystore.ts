// Where the pair's root key lives: the device keychain, and nowhere else.
// The key is created during pairing and never leaves the phone — the relay
// only ever sees ciphertext sealed with keys derived from it.
import type { Relay } from './crypto/relay';

export interface StoredPair {
  rootKeyHex: string;
  pairId: string;
  word: string;
}

export interface Keystore {
  save(pair: StoredPair): Promise<void>;
  load(): Promise<StoredPair | null>;
  clear(): Promise<void>;
}

const STORE_KEY = 'thaw.pair.v1';

/** Backed by expo-secure-store (iOS Keychain). Falls back to localStorage on web — demo only. */
export function createDeviceKeystore(): Keystore {
  return {
    async save(pair) {
      const SecureStore = await import('expo-secure-store');
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(pair));
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORE_KEY, JSON.stringify(pair));
      }
    },
    async load() {
      const SecureStore = await import('expo-secure-store');
      const raw = (await SecureStore.isAvailableAsync())
        ? await SecureStore.getItemAsync(STORE_KEY)
        : typeof localStorage !== 'undefined'
          ? localStorage.getItem(STORE_KEY)
          : null;
      return raw ? (JSON.parse(raw) as StoredPair) : null;
    },
    async clear() {
      const SecureStore = await import('expo-secure-store');
      if (await SecureStore.isAvailableAsync()) {
        await SecureStore.deleteItemAsync(STORE_KEY);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORE_KEY);
      }
    },
  };
}

/** In-memory keystore for tests. */
export function createMemoryKeystore(): Keystore & { contents: () => StoredPair | null } {
  let stored: StoredPair | null = null;
  return {
    contents: () => stored,
    async save(pair) {
      stored = pair;
    },
    async load() {
      return stored;
    },
    async clear() {
      stored = null;
    },
  };
}

/**
 * Unpair: wipe the pair's blobs from the relay, then the keys from the
 * device. Local wipe happens even if the relay is unreachable — losing the
 * key makes any remaining remote ciphertext permanently unreadable anyway.
 */
export async function unpair(keystore: Keystore, relay: Relay): Promise<void> {
  const pair = await keystore.load();
  if (pair) {
    try {
      await relay.deletePair(pair.pairId);
    } catch {
      // Remote wipe is best-effort; blobs also expire on their own TTL.
    }
  }
  await keystore.clear();
}
