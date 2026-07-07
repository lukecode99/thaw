// Wires the poll-only signal design (docs/privacy-label.md) into the UI:
// checks the relay for partner activity while this phone has nothing
// submitted, and raises fixed-copy device signals on state transitions.
// useReveal's own 12s poll drives the reveal-ready side of the state.
import { useEffect, useRef, useState } from 'react';

import type { Relay } from './crypto/relay';
import type { EntryStore } from './entryStore';
import {
  deriveSignal,
  PARTNER_POLL_MS,
  presentSignal,
  showDeviceSignal,
  type SignalState,
} from './notifications';
import { partnerHasWritten } from './reveal';

export function useNotifications({
  relay,
  store,
  pairId,
  mineSubmitted,
  revealReady,
  enabled,
}: {
  relay: Relay;
  store: EntryStore | null;
  pairId: string | null;
  mineSubmitted: boolean;
  revealReady: boolean;
  enabled: boolean;
}) {
  const [partnerWaiting, setPartnerWaiting] = useState(false);

  // While nothing is submitted here, poll the relay for partner activity —
  // list-only, so the request carries no content in either direction.
  useEffect(() => {
    if (!store || !pairId || mineSubmitted) {
      setPartnerWaiting(false);
      return;
    }
    let alive = true;
    const check = async () => {
      try {
        const waiting = await partnerHasWritten(relay, pairId, await store.ownIds());
        if (alive) setPartnerWaiting(waiting);
      } catch {
        // Offline — keep the last known state; the next poll retries.
      }
    };
    check();
    const timer = setInterval(check, PARTNER_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [relay, store, pairId, mineSubmitted]);

  // Raise a device signal when the pair state transitions.
  const prev = useRef<SignalState>({ mineSubmitted, partnerHasWritten: false });
  useEffect(() => {
    const next: SignalState = {
      mineSubmitted,
      partnerHasWritten: partnerWaiting || revealReady,
    };
    presentSignal(deriveSignal(prev.current, next), enabled, showDeviceSignal);
    prev.current = next;
  }, [mineSubmitted, partnerWaiting, revealReady, enabled]);

  return { partnerWaiting };
}
