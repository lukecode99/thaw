// Executes the pairing state machine against the real world: runs the key
// derivation off the render path, publishes the sealed key, polls for the
// partner's, and persists the result to the device keystore.
import { useCallback, useEffect, useRef, useState } from 'react';
import { bytesToHex } from '@noble/hashes/utils';

import {
  deriveSecrets,
  generateCode,
  generateKeyPair,
  sealPublicKey,
  type KeyPair,
  type PairingSecrets,
} from './crypto/pairing';
import type { Relay } from './crypto/relay';
import type { Keystore } from './keystore';
import {
  reducePairing,
  startPairing,
  type PairingEvent,
  type PairingState,
} from './pairingMachine';

const POLL_INTERVAL_MS = 2500;

export function usePairing(relay: Relay, keystore: Keystore, onPaired: () => void) {
  const [state, setState] = useState<PairingState>(() => startPairing(generateCode(), Date.now()));
  const stateRef = useRef(state);
  const ctx = useRef<{ secrets: PairingSecrets; keyPair: KeyPair } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const apply = useCallback(
    (event: PairingEvent) => {
      const { state: next, effects } = reducePairing(stateRef.current, event);
      stateRef.current = next;
      setState(next);

      for (const effect of effects) {
        if (effect.kind === 'derive') {
          // scrypt is deliberately slow; yield first so the screen can paint.
          timers.current.push(
            setTimeout(() => {
              try {
                const secrets = deriveSecrets(effect.ownCode, effect.partnerCode);
                const keyPair = generateKeyPair();
                ctx.current = { secrets, keyPair };
                apply({ type: 'derived', secrets, keyPair });
              } catch {
                apply({ type: 'network-error' });
              }
            }, 30),
          );
        }

        if (effect.kind === 'publish-and-poll' && ctx.current) {
          const { secrets, keyPair } = ctx.current;
          const payload = sealPublicKey(secrets, keyPair.publicKey);
          relay
            .putPairingPayload(effect.sid, effect.ownSlot, payload)
            .then(function poll(): void {
              const current = stateRef.current;
              if (current.step !== 'exchanging') return;
              relay
                .getPairingPayload(effect.sid, effect.peer)
                .then((peerPayload) => {
                  if (peerPayload !== null) {
                    apply({ type: 'peer-payload', payload: peerPayload, now: Date.now() });
                  } else {
                    apply({ type: 'tick', now: Date.now() });
                    timers.current.push(setTimeout(poll, POLL_INTERVAL_MS));
                  }
                })
                .catch(() => apply({ type: 'network-error' }));
            })
            .catch(() => apply({ type: 'network-error' }));
        }

        if (effect.kind === 'cleanup-session') {
          relay.deletePairingSession(effect.sid).catch(() => {});
        }
      }

      if (next.step === 'paired') {
        keystore
          .save({
            rootKeyHex: bytesToHex(next.rootKey),
            pairId: next.pairId,
            word: next.word,
            slot: next.slot,
          })
          .then(onPaired)
          .catch(onPaired);
      }
    },
    [relay, keystore, onPaired],
  );

  useEffect(() => () => clearTimers(), []);

  const submitCode = useCallback(
    (partnerCode: string) => apply({ type: 'submit-code', partnerCode, now: Date.now() }),
    [apply],
  );

  const confirm = useCallback(() => apply({ type: 'confirm' }), [apply]);

  const retry = useCallback(() => {
    clearTimers();
    ctx.current = null;
    apply({ type: 'retry', ownCode: generateCode(), now: Date.now() });
  }, [apply]);

  return { state, submitCode, confirm, retry };
}
