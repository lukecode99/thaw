// Entry encryption. An entry is sealed on the phone with a key derived from
// the pair's root key; the relay only ever stores the opaque result.
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

import type { EntryAnswers } from '../entries';
import { fromBase64Url, toBase64Url } from './pairing';

const NONCE_LENGTH = 24;

export interface EntryPlaintext {
  v: 1;
  answers: EntryAnswers;
  createdAt: number;
}

function entryKey(rootKey: Uint8Array): Uint8Array {
  return hkdf(sha256, rootKey, undefined, utf8ToBytes('thaw-entry-v1'), 32);
}

/** A fresh random id for a submitted entry (also its relay key). */
export function generateEntryId(): string {
  return bytesToHex(randomBytes(16));
}

/** Seal an entry for the relay: nonce ‖ XChaCha20-Poly1305(JSON). */
export function sealEntry(rootKeyHex: string, plaintext: EntryPlaintext): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const bytes = utf8ToBytes(JSON.stringify(plaintext));
  const sealed = xchacha20poly1305(entryKey(hexToBytes(rootKeyHex)), nonce).encrypt(bytes);
  return toBase64Url(concatBytes(nonce, sealed));
}

/** Open a sealed entry. Returns null if it does not verify or parse. */
export function openEntry(rootKeyHex: string, payload: string): EntryPlaintext | null {
  try {
    const bytes = fromBase64Url(payload);
    const nonce = bytes.slice(0, NONCE_LENGTH);
    const plain = xchacha20poly1305(entryKey(hexToBytes(rootKeyHex)), nonce).decrypt(
      bytes.slice(NONCE_LENGTH),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as EntryPlaintext;
    return parsed.v === 1 && parsed.answers ? parsed : null;
  } catch {
    return null;
  }
}
