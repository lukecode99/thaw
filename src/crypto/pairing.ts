// Pairing cryptography. Everything here runs on the phones; the relay only
// ever carries the sealed, opaque outputs of these functions.
//
// Scheme (mutual, code-authenticated key exchange):
// 1. Each phone shows its own 6-digit code and the partner types it — both
//    directions, within a 10-minute window. Neither code is ever transmitted.
// 2. Both phones derive the same secrets from the sorted code pair with
//    scrypt (deliberately expensive, so the relay cannot cheaply brute-force
//    the code space out of the rendezvous id it observes):
//      rendezvous id  — where the two phones meet on the relay
//      sealing key    — encrypts/authenticates the exchanged public keys
// 3. Each phone generates a fresh x25519 keypair, seals its public key with
//    the code-derived key (XChaCha20-Poly1305), and posts it to its slot.
//    A relay that doesn't know the codes can neither read nor substitute
//    a public key — a swapped payload simply fails to open.
// 4. Both phones compute the shared secret (ECDH), derive the pair's root
//    key, and display the same confirmation word — partners compare it out
//    loud as the final human check before anything is stored.
import { x25519 } from '@noble/curves/ed25519';
import { hkdf } from '@noble/hashes/hkdf';
import { scrypt } from '@noble/hashes/scrypt';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

import { CONFIRMATION_WORDS } from './words';

export const PAIRING_WINDOW_MS = 10 * 60 * 1000;
export const CODE_LENGTH = 6;

const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, dkLen: 64 };
const NONCE_LENGTH = 24;

export type Slot = 'a' | 'b';

export interface PairingSecrets {
  rendezvousId: string; // 32-hex relay session id
  sealingKey: Uint8Array; // 32 bytes, protects the public-key exchange
}

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** A 6-digit pairing code from device randomness (leading zeros allowed). */
export function generateCode(): string {
  const bytes = randomBytes(4);
  const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0);
  return String(n % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, '0');
}

export function isValidCode(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}

/** Both phones sort the two codes the same way, so both derive identical secrets. */
function sortedCodes(ownCode: string, partnerCode: string): [string, string] {
  return ownCode < partnerCode ? [ownCode, partnerCode] : [partnerCode, ownCode];
}

/** Which relay slot this device writes to. The lower code takes slot "a". */
export function slotFor(ownCode: string, partnerCode: string): Slot {
  return ownCode < partnerCode ? 'a' : 'b';
}

export function peerSlot(slot: Slot): Slot {
  return slot === 'a' ? 'b' : 'a';
}

/**
 * Derive the rendezvous id and sealing key from the two codes. Expensive by
 * design (scrypt) — call it once, off the render path.
 */
export function deriveSecrets(ownCode: string, partnerCode: string): PairingSecrets {
  if (!isValidCode(ownCode) || !isValidCode(partnerCode)) {
    throw new Error('codes must be 6 digits');
  }
  if (ownCode === partnerCode) {
    throw new Error('codes must differ');
  }
  const [first, second] = sortedCodes(ownCode, partnerCode);
  const master = scrypt(`${first}:${second}`, 'thaw-pair-v1', SCRYPT_PARAMS);
  return {
    rendezvousId: bytesToHex(master.slice(0, 16)),
    sealingKey: master.slice(16, 48),
  };
}

export function generateKeyPair(): KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

/** Seal a public key for the relay: nonce ‖ XChaCha20-Poly1305(publicKey). */
export function sealPublicKey(secrets: PairingSecrets, publicKey: Uint8Array): string {
  const nonce = randomBytes(NONCE_LENGTH);
  const sealed = xchacha20poly1305(secrets.sealingKey, nonce).encrypt(publicKey);
  return toBase64Url(concatBytes(nonce, sealed));
}

/** Open the partner's sealed public key. Returns null if it doesn't verify. */
export function openPublicKey(secrets: PairingSecrets, payload: string): Uint8Array | null {
  try {
    const bytes = fromBase64Url(payload);
    const nonce = bytes.slice(0, NONCE_LENGTH);
    return xchacha20poly1305(secrets.sealingKey, nonce).decrypt(bytes.slice(NONCE_LENGTH));
  } catch {
    return null;
  }
}

/**
 * The pair's root key: ECDH shared secret bound to both codes via HKDF.
 * Identical on both phones; never leaves either.
 */
export function deriveRootKey(
  ownPrivateKey: Uint8Array,
  partnerPublicKey: Uint8Array,
  secrets: PairingSecrets,
): Uint8Array {
  const shared = x25519.getSharedSecret(ownPrivateKey, partnerPublicKey);
  return hkdf(sha256, shared, secrets.sealingKey, utf8ToBytes('thaw-root-v1'), 32);
}

/** Stable id the relay uses to route this pair's ciphertext blobs. */
export function derivePairId(rootKey: Uint8Array): string {
  return bytesToHex(hkdf(sha256, rootKey, undefined, utf8ToBytes('thaw-pair-id-v1'), 16));
}

/** The confirmation word both partners read out loud. Same key → same word. */
export function confirmationWord(rootKey: Uint8Array): string {
  const okm = hkdf(sha256, rootKey, undefined, utf8ToBytes('thaw-sas-v1'), 2);
  const index = ((okm[0] << 8) | okm[1]) % CONFIRMATION_WORDS.length;
  return CONFIRMATION_WORDS[index];
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary =
    typeof atob === 'function'
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
