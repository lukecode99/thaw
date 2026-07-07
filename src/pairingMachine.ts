// Pairing state machine — a pure reducer, so every path is unit-testable.
// Time arrives in events (never read here) and side effects are returned as
// descriptions for the caller to execute.
import {
  confirmationWord,
  derivePairId,
  deriveRootKey,
  isValidCode,
  openPublicKey,
  PAIRING_WINDOW_MS,
  peerSlot,
  slotFor,
  type KeyPair,
  type PairingSecrets,
  type Slot,
} from './crypto/pairing';

export type FailureReason = 'expired' | 'mismatch' | 'network';

export type PairingState =
  | { step: 'showing'; ownCode: string; startedAt: number }
  | { step: 'deriving'; ownCode: string; partnerCode: string; startedAt: number }
  | {
      step: 'exchanging';
      ownCode: string;
      startedAt: number;
      secrets: PairingSecrets;
      keyPair: KeyPair;
      slot: Slot;
    }
  | {
      step: 'confirming';
      word: string;
      rootKey: Uint8Array;
      pairId: string;
      sid: string;
      slot: Slot;
    }
  | { step: 'paired'; rootKey: Uint8Array; pairId: string; word: string; slot: Slot }
  | { step: 'failed'; reason: FailureReason };

export type PairingEvent =
  | { type: 'submit-code'; partnerCode: string; now: number }
  | { type: 'derived'; secrets: PairingSecrets; keyPair: KeyPair }
  | { type: 'peer-payload'; payload: string; now: number }
  | { type: 'tick'; now: number }
  | { type: 'confirm' }
  | { type: 'network-error' }
  | { type: 'retry'; ownCode: string; now: number };

export type PairingEffect =
  | { kind: 'derive'; ownCode: string; partnerCode: string }
  | { kind: 'publish-and-poll'; sid: string; ownSlot: Slot; peer: Slot; sealedKey: true }
  | { kind: 'cleanup-session'; sid: string };

export interface Transition {
  state: PairingState;
  effects: PairingEffect[];
}

export const CODE_TYPO_MESSAGE = 'Codes are 6 digits — check what your partner sees.';
export const FAILURE_MESSAGES: Record<FailureReason, string> = {
  expired: "That took a little too long — codes only last ten minutes. Grab a fresh one and try again.",
  mismatch: "Those codes didn't line up. Compare screens with your partner and try once more.",
  network: "We couldn't reach the sync service. Check your connection and try again.",
};

export function startPairing(ownCode: string, now: number): PairingState {
  return { step: 'showing', ownCode, startedAt: now };
}

const stay = (state: PairingState): Transition => ({ state, effects: [] });

export function reducePairing(state: PairingState, event: PairingEvent): Transition {
  if (event.type === 'retry') {
    return stay(startPairing(event.ownCode, event.now));
  }

  if (event.type === 'network-error') {
    return stay({ step: 'failed', reason: 'network' });
  }

  if (event.type === 'tick') {
    if (
      (state.step === 'showing' || state.step === 'deriving' || state.step === 'exchanging') &&
      event.now - state.startedAt > PAIRING_WINDOW_MS
    ) {
      return stay({ step: 'failed', reason: 'expired' });
    }
    return stay(state);
  }

  switch (state.step) {
    case 'showing': {
      if (event.type !== 'submit-code') return stay(state);
      if (event.now - state.startedAt > PAIRING_WINDOW_MS) {
        return stay({ step: 'failed', reason: 'expired' });
      }
      const partnerCode = event.partnerCode.trim();
      // Typos and own-code echoes stay on the screen for another attempt.
      if (!isValidCode(partnerCode) || partnerCode === state.ownCode) return stay(state);
      return {
        state: { step: 'deriving', ownCode: state.ownCode, partnerCode, startedAt: state.startedAt },
        effects: [{ kind: 'derive', ownCode: state.ownCode, partnerCode }],
      };
    }

    case 'deriving': {
      if (event.type !== 'derived') return stay(state);
      const slot = slotFor(state.ownCode, state.partnerCode);
      return {
        state: {
          step: 'exchanging',
          ownCode: state.ownCode,
          startedAt: state.startedAt,
          secrets: event.secrets,
          keyPair: event.keyPair,
          slot,
        },
        effects: [
          {
            kind: 'publish-and-poll',
            sid: event.secrets.rendezvousId,
            ownSlot: slot,
            peer: peerSlot(slot),
            sealedKey: true,
          },
        ],
      };
    }

    case 'exchanging': {
      if (event.type !== 'peer-payload') return stay(state);
      if (event.now - state.startedAt > PAIRING_WINDOW_MS) {
        return stay({ step: 'failed', reason: 'expired' });
      }
      const partnerPublicKey = openPublicKey(state.secrets, event.payload);
      // A payload that fails to open was not sealed with our codes — treat it
      // as a code mismatch rather than accepting an unauthenticated key.
      if (!partnerPublicKey) return stay({ step: 'failed', reason: 'mismatch' });
      const rootKey = deriveRootKey(state.keyPair.privateKey, partnerPublicKey, state.secrets);
      const pairId = derivePairId(rootKey);
      return {
        state: {
          step: 'confirming',
          word: confirmationWord(rootKey),
          rootKey,
          pairId,
          sid: state.secrets.rendezvousId,
          slot: state.slot,
        },
        effects: [],
      };
    }

    case 'confirming': {
      if (event.type !== 'confirm') return stay(state);
      return {
        state: {
          step: 'paired',
          rootKey: state.rootKey,
          pairId: state.pairId,
          word: state.word,
          slot: state.slot,
        },
        effects: [{ kind: 'cleanup-session', sid: state.sid }],
      };
    }

    default:
      return stay(state);
  }
}
