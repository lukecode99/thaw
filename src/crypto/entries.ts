// Entry encryption. An entry is sealed on the phone with a key derived from
// the pair's root key; the relay only ever stores the opaque result. Closing
// lines (the short "what I'm taking from this" after a reveal) are sealed
// the same way, tagged by kind inside the ciphertext.
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

import type { EntryAnswers } from '../entries';
import { fromBase64Url, toBase64Url } from './pairing';

const NONCE_LENGTH = 24;

export interface EntryPlaintext {
  v: 1;
  kind?: 'entry';
  answers: EntryAnswers;
  tag?: string; // topic chosen at creation; travels only inside the ciphertext
  createdAt: number;
}

export interface ClosingPlaintext {
  v: 1;
  kind: 'closing';
  by: string; // entry id of the author's own sealed entry
  text: string;
  createdAt: number;
}

export type BlobPlaintext =
  | (EntryPlaintext & { kind: 'entry' })
  | ClosingPlaintext;

function entryKey(rootKey: Uint8Array): Uint8Array {
  return hkdf(sha256, rootKey, undefined, utf8ToBytes('thaw-entry-v1'), 32);
}

// A separate key for what rests on the device itself, so local storage and
// relay blobs never share ciphertexts.
function localKey(rootKey: Uint8Array): Uint8Array {
  return hkdf(sha256, rootKey, undefined, utf8ToBytes('thaw-local-v1'), 32);
}

/** Seal a string for local at-rest storage: nonce ‖ XChaCha20-Poly1305. */
export function sealLocal(rootKeyHex: string, value: string): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const sealed = xchacha20poly1305(localKey(hexToBytes(rootKeyHex)), nonce).encrypt(
    utf8ToBytes(value),
  );
  return toBase64Url(concatBytes(nonce, sealed));
}

/** Open a locally sealed string. Returns null if it does not verify. */
export function openLocal(rootKeyHex: string, payload: string): string | null {
  try {
    const bytes = fromBase64Url(payload);
    const plain = xchacha20poly1305(
      localKey(hexToBytes(rootKeyHex)),
      bytes.slice(0, NONCE_LENGTH),
    ).decrypt(bytes.slice(NONCE_LENGTH));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** A fresh random id for a submitted blob (also its relay key). */
export function generateEntryId(): string {
  return bytesToHex(randomBytes(16));
}

function seal(rootKeyHex: string, plaintext: object): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const bytes = utf8ToBytes(JSON.stringify(plaintext));
  const sealed = xchacha20poly1305(entryKey(hexToBytes(rootKeyHex)), nonce).encrypt(bytes);
  return toBase64Url(concatBytes(nonce, sealed));
}

/** Seal an entry for the relay: nonce ‖ XChaCha20-Poly1305(JSON). */
export function sealEntry(rootKeyHex: string, plaintext: EntryPlaintext): string {
  return seal(rootKeyHex, { ...plaintext, kind: 'entry' });
}

export function sealClosing(rootKeyHex: string, plaintext: Omit<ClosingPlaintext, 'v' | 'kind'>): string {
  return seal(rootKeyHex, { v: 1, kind: 'closing', ...plaintext });
}

/** Open any sealed blob. Returns null if it does not verify or parse. */
export function openBlob(rootKeyHex: string, payload: string): BlobPlaintext | null {
  try {
    const bytes = fromBase64Url(payload);
    const nonce = bytes.slice(0, NONCE_LENGTH);
    const plain = xchacha20poly1305(entryKey(hexToBytes(rootKeyHex)), nonce).decrypt(
      bytes.slice(NONCE_LENGTH),
    );
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as BlobPlaintext;
    if (parsed.v !== 1) return null;
    if (parsed.kind === 'closing') return typeof parsed.text === 'string' ? parsed : null;
    return parsed.answers ? { ...parsed, kind: 'entry' } : null;
  } catch {
    return null;
  }
}

/** Open a sealed entry. Returns null for anything that is not an entry. */
export function openEntry(rootKeyHex: string, payload: string): EntryPlaintext | null {
  const blob = openBlob(rootKeyHex, payload);
  return blob?.kind === 'entry' ? blob : null;
}
