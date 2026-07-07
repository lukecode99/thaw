// Partner signals, privacy-label-safe: no push tokens, no server-held
// identifiers. The app polls the relay (list-only) and raises fixed-copy
// signals locally. Decision record: docs/privacy-label.md.

export type SignalKind = 'partner-wrote' | 'reveal-ready';

// Fixed copy only. Signals are built exclusively from these constants, so
// nothing either partner wrote can ever reach a notification payload.
export const SIGNAL_COPY: Record<SignalKind, { title: string; body: string }> = {
  'partner-wrote': {
    title: 'Your partner has written their side',
    body: 'Write yours to unlock both.',
  },
  'reveal-ready': {
    title: 'Both sides are in',
    body: 'Your reveal is ready.',
  },
};

/** Everything a signal may depend on: two booleans. Content cannot flow in. */
export interface SignalState {
  mineSubmitted: boolean;
  partnerHasWritten: boolean;
}

/** The signal, if any, that a state transition should raise. */
export function deriveSignal(prev: SignalState, next: SignalState): SignalKind | null {
  if (!prev.partnerHasWritten && next.partnerHasWritten) {
    return next.mineSubmitted ? 'reveal-ready' : 'partner-wrote';
  }
  if (next.partnerHasWritten && !prev.mineSubmitted && next.mineSubmitted) {
    return 'reveal-ready';
  }
  return null;
}

/** Renders a signal through `show` — unless the user turned signals off. */
export function presentSignal(
  kind: SignalKind | null,
  enabled: boolean,
  show: (title: string, body: string) => void,
): void {
  if (!kind || !enabled) return;
  const copy = SIGNAL_COPY[kind];
  show(copy.title, copy.body);
}

/**
 * Device-level presentation. On web this uses the browser Notification API
 * when permission is already granted and the tab is hidden; everywhere else
 * it is a no-op — the cards on Home always carry the same information.
 */
export function showDeviceSignal(title: string, body: string): void {
  try {
    const g = globalThis as {
      document?: { hidden?: boolean };
      Notification?: { permission?: string } & (new (t: string, o: { body: string }) => unknown);
    };
    if (g.Notification?.permission === 'granted' && g.document?.hidden) {
      new g.Notification(title, { body });
    }
  } catch {
    // Best-effort only; the in-app state is the source of truth.
  }
}

/** Home checks the relay for partner activity this often. */
export const PARTNER_POLL_MS = 60_000;
