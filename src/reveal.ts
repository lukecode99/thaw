// The reveal: both sides stay sealed until both partners' ciphertexts exist
// and decrypt on this phone. Pure derivation (unit-testable) plus the fetch
// routine that syncs the partner's blobs down from the relay.
import { openBlob, type ClosingPlaintext, type EntryPlaintext } from './crypto/entries';
import type { Slot } from './crypto/pairing';
import type { Relay } from './crypto/relay';
import type { RepairEntry } from './entries';

export interface PartnerSide {
  /** 'none' — nothing from the partner yet; 'trouble' — a blob would not open. */
  status: 'none' | 'trouble' | 'present';
  entry: (EntryPlaintext & { id: string }) | null;
  closing: ClosingPlaintext | null;
}

export type RevealPhase =
  | { phase: 'no-entry' } // nothing submitted on this phone
  | { phase: 'waiting'; mine: RepairEntry } // ours sealed, partner pending
  | { phase: 'trouble'; mine: RepairEntry } // partner data present but unreadable
  | {
      phase: 'ready';
      mine: RepairEntry;
      theirs: EntryPlaintext & { id: string };
      myClosing: string | null;
      theirClosing: string | null;
    };

/**
 * The single rule that gates the reveal: it exists only when our entry is
 * submitted AND the partner's entry arrived and decrypted. Every earlier
 * state renders sealed.
 */
export function deriveReveal(
  mine: RepairEntry | null,
  partner: PartnerSide,
  myClosing: string | null,
): RevealPhase {
  if (!mine) return { phase: 'no-entry' };
  if (partner.status === 'trouble') return { phase: 'trouble', mine };
  if (partner.status === 'none' || !partner.entry) return { phase: 'waiting', mine };
  return {
    phase: 'ready',
    mine,
    theirs: partner.entry,
    myClosing,
    theirClosing: partner.closing?.text ?? null,
  };
}

/**
 * Cheap presence check for a phone with nothing submitted: has the partner's
 * slot got any blob on it? Index-only — one relay read, no payloads fetched,
 * nothing decrypted, so the check sees activity, never content. `ownIds`
 * stays as a guard even though the partner slot should never hold our ids.
 */
export async function partnerHasWritten(
  relay: Relay,
  pairId: string,
  partnerSlot: Slot,
  ownIds: Set<string>,
): Promise<boolean> {
  const listed = await relay.listEntries(pairId, partnerSlot);
  return listed.some((item) => !ownIds.has(item.id));
}

/**
 * Pull the partner's blobs: everything on the relay under their slot. A blob
 * that fails to open is re-fetched once — if it still will not open we
 * report trouble, and never delete anything.
 */
export async function fetchPartnerSide(
  relay: Relay,
  pairId: string,
  partnerSlot: Slot,
  rootKeyHex: string,
  ownIds: Set<string>,
): Promise<PartnerSide> {
  const listed = await relay.listEntries(pairId, partnerSlot);
  const candidates = listed.filter((item) => !ownIds.has(item.id));
  const side: PartnerSide = { status: 'none', entry: null, closing: null };

  for (const { id } of candidates) {
    let payload = await relay.getEntry(pairId, partnerSlot, id);
    if (payload === null) continue; // expired between list and get
    let blob = openBlob(rootKeyHex, payload);
    if (!blob) {
      // One clean re-fetch in case the first read was a corrupt transfer.
      payload = await relay.getEntry(pairId, partnerSlot, id);
      blob = payload === null ? null : openBlob(rootKeyHex, payload);
      if (!blob) {
        side.status = 'trouble';
        continue;
      }
    }
    if (blob.kind === 'entry') {
      if (!side.entry || blob.createdAt > side.entry.createdAt) {
        side.entry = { ...blob, id };
      }
    } else if (!side.closing || blob.createdAt > side.closing.createdAt) {
      side.closing = blob;
    }
  }

  if (side.entry) side.status = 'present';
  return side;
}
