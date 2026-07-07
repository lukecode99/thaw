// Keeps the reveal state fresh: refetches the partner's side on demand and
// polls gently while we are waiting on them. Once the partner's side arrives
// it is cached on this device (encrypted at rest) so history outlives the
// relay's retention window.
import { useCallback, useEffect, useRef, useState } from 'react';

import { peerSlot, type Slot } from './crypto/pairing';
import type { Relay } from './crypto/relay';
import type { RepairEntry } from './entries';
import type { EntryStore } from './entryStore';
import { deriveReveal, fetchPartnerSide, type PartnerSide, type RevealPhase } from './reveal';

export const POLL_INTERVAL_MS = 12_000;

export function useReveal(
  relay: Relay,
  store: EntryStore | null,
  pairId: string | null,
  slot: Slot | null,
  rootKeyHex: string | null,
  mine: RepairEntry | null,
) {
  const [partner, setPartner] = useState<PartnerSide>({
    status: 'none',
    entry: null,
    closing: null,
  });
  const [myClosing, setMyClosing] = useState<string | null>(null);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!store || !pairId || !slot || !rootKeyHex || !mine || busy.current) return;
    busy.current = true;
    try {
      await store.flushQueue(relay, pairId, slot);
      const closings = await store.listClosings();
      setMyClosing(closings.find((c) => c.by === mine.id)?.text ?? null);
      const side = await fetchPartnerSide(
        relay,
        pairId,
        peerSlot(slot),
        rootKeyHex,
        await store.ownIds(),
      );
      if (side.status === 'present' && side.entry) {
        await store.savePartnerSide(mine.id, side.entry, side.closing);
      }
      setPartner(side);
    } catch {
      // Network trouble — keep the last known state; the next poll retries.
    } finally {
      busy.current = false;
    }
  }, [relay, store, pairId, slot, rootKeyHex, mine]);

  // Poll while our side is in and the partner's entry — or their closing
  // line — has not arrived yet.
  useEffect(() => {
    if (!mine || (partner.status === 'present' && partner.closing)) return;
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [mine, partner.status, partner.closing, refresh]);

  const saveClosing = useCallback(
    async (text: string) => {
      if (!store || !pairId || !slot || !rootKeyHex || !mine) return;
      await store.submitClosing(mine.id, text, rootKeyHex, Date.now());
      setMyClosing(text.trim());
      await store.flushQueue(relay, pairId, slot);
    },
    [relay, store, pairId, slot, rootKeyHex, mine],
  );

  const reveal: RevealPhase = deriveReveal(mine, partner, myClosing);
  return { reveal, refresh, saveClosing };
}
