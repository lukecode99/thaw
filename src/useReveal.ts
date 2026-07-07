// Keeps the reveal state fresh: refetches the partner's side on demand and
// polls gently while we are waiting on them.
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Relay } from './crypto/relay';
import type { RepairEntry } from './entries';
import type { EntryStore } from './entryStore';
import { deriveReveal, fetchPartnerSide, type PartnerSide, type RevealPhase } from './reveal';

const POLL_INTERVAL_MS = 12_000;

export function useReveal(
  relay: Relay,
  store: EntryStore,
  pairId: string | null,
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
    if (!pairId || !rootKeyHex || !mine || busy.current) return;
    busy.current = true;
    try {
      await store.flushQueue(relay, pairId);
      const closings = await store.listClosings();
      setMyClosing(closings.find((c) => c.by === mine.id)?.text ?? null);
      setPartner(await fetchPartnerSide(relay, pairId, rootKeyHex, await store.ownIds()));
    } catch {
      // Network trouble — keep the last known state; the next poll retries.
    } finally {
      busy.current = false;
    }
  }, [relay, store, pairId, rootKeyHex, mine]);

  // Poll while our side is in and the partner's has not arrived yet.
  useEffect(() => {
    if (!mine || partner.status === 'present') return;
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [mine, partner.status, refresh]);

  const saveClosing = useCallback(
    async (text: string) => {
      if (!pairId || !rootKeyHex || !mine) return;
      await store.submitClosing(mine.id, text, rootKeyHex, Date.now());
      setMyClosing(text.trim());
      await store.flushQueue(relay, pairId);
    },
    [relay, store, pairId, rootKeyHex, mine],
  );

  const reveal: RevealPhase = deriveReveal(mine, partner, myClosing);
  return { reveal, refresh, saveClosing };
}
