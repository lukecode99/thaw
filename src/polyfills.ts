// Hermes has no WebCrypto; the pairing code needs crypto.getRandomValues for
// key and nonce generation. Web and node provide it natively, so this no-ops
// everywhere except native.
import { getRandomValues } from 'expo-crypto';

const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (!g.crypto) g.crypto = {};
if (!g.crypto.getRandomValues) g.crypto.getRandomValues = getRandomValues;
