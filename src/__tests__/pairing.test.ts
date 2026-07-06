import { bytesToHex } from '@noble/hashes/utils';

import {
  deriveRootKey,
  deriveSecrets,
  generateCode,
  generateKeyPair,
  isValidCode,
  openPublicKey,
  sealPublicKey,
  slotFor,
  type KeyPair,
  type PairingSecrets,
} from '../crypto/pairing';
import { createMemoryRelay, type Relay } from '../crypto/relay';
import { CONFIRMATION_WORDS } from '../crypto/words';
import { createMemoryKeystore, unpair } from '../keystore';
import {
  reducePairing,
  startPairing,
  type PairingState,
} from '../pairingMachine';

jest.setTimeout(30000); // scrypt is deliberately slow

const T0 = 1_700_000_000_000;
const MINUTES = 60 * 1000;

interface SimulatedClient {
  state: PairingState;
  secrets: PairingSecrets;
  keyPair: KeyPair;
  ownCode: string;
}

/** Drive one phone through the machine up to "waiting for partner". */
async function reachExchange(
  relay: Relay,
  ownCode: string,
  partnerCode: string,
  now: number,
): Promise<SimulatedClient> {
  let t = reducePairing(startPairing(ownCode, now), {
    type: 'submit-code',
    partnerCode,
    now,
  });
  expect(t.state.step).toBe('deriving');
  expect(t.effects[0]).toMatchObject({ kind: 'derive' });

  const secrets = deriveSecrets(ownCode, partnerCode);
  const keyPair = generateKeyPair();
  t = reducePairing(t.state, { type: 'derived', secrets, keyPair });
  expect(t.state.step).toBe('exchanging');
  expect(t.effects[0]).toMatchObject({ kind: 'publish-and-poll', sid: secrets.rendezvousId });

  await relay.putPairingPayload(
    secrets.rendezvousId,
    slotFor(ownCode, partnerCode),
    sealPublicKey(secrets, keyPair.publicKey),
  );
  return { state: t.state, secrets, keyPair, ownCode };
}

/** Deliver the partner's relay payload to a waiting client. */
async function receivePeer(relay: Relay, client: SimulatedClient, partnerCode: string, now: number) {
  const peer = slotFor(partnerCode, client.ownCode);
  const payload = await relay.getPairingPayload(client.secrets.rendezvousId, peer);
  expect(payload).not.toBeNull();
  return reducePairing(client.state, { type: 'peer-payload', payload: payload!, now });
}

describe('mutual pairing — two simulated clients', () => {
  test('both codes entered within the window → both pair with the same word and pair id', async () => {
    const relay = createMemoryRelay();
    const alice = await reachExchange(relay, '111111', '222222', T0);
    const bob = await reachExchange(relay, '222222', '111111', T0 + 1 * MINUTES);

    const aliceDone = await receivePeer(relay, alice, '222222', T0 + 2 * MINUTES);
    const bobDone = await receivePeer(relay, bob, '111111', T0 + 2 * MINUTES);

    expect(aliceDone.state.step).toBe('confirming');
    expect(bobDone.state.step).toBe('confirming');
    if (aliceDone.state.step !== 'confirming' || bobDone.state.step !== 'confirming') return;

    // The confirmation word matches deterministically on both ends.
    expect(aliceDone.state.word).toBe(bobDone.state.word);
    expect(CONFIRMATION_WORDS).toContain(aliceDone.state.word);
    expect(bytesToHex(aliceDone.state.rootKey)).toBe(bytesToHex(bobDone.state.rootKey));
    expect(aliceDone.state.pairId).toBe(bobDone.state.pairId);

    // Confirming completes the pairing and cleans up the rendezvous.
    const paired = reducePairing(aliceDone.state, { type: 'confirm' });
    expect(paired.state.step).toBe('paired');
    expect(paired.effects[0]).toMatchObject({ kind: 'cleanup-session' });
  });

  test('a wrong code lands on a different rendezvous — no payload ever arrives', async () => {
    const relay = createMemoryRelay();
    const alice = await reachExchange(relay, '111111', '222222', T0);
    // Bob typed 333333 instead of Alice's 111111.
    const bob = await reachExchange(relay, '222222', '333333', T0);

    expect(bob.secrets.rendezvousId).not.toBe(alice.secrets.rendezvousId);
    const peerForAlice = await relay.getPairingPayload(alice.secrets.rendezvousId, 'b');
    expect(peerForAlice).toBeNull();

    // The window closes and both fail safely with a retryable state.
    const expired = reducePairing(alice.state, { type: 'tick', now: T0 + 11 * MINUTES });
    expect(expired.state).toEqual({ step: 'failed', reason: 'expired' });
    const retried = reducePairing(expired.state, { type: 'retry', ownCode: '444444', now: T0 });
    expect(retried.state.step).toBe('showing');
  });

  test('a payload not sealed with the same codes is rejected, never accepted', async () => {
    const relay = createMemoryRelay();
    const alice = await reachExchange(relay, '111111', '222222', T0);
    // An imposter (or the relay itself) plants a key sealed with different codes.
    const wrongSecrets = deriveSecrets('555555', '666666');
    const imposter = generateKeyPair();
    await relay.putPairingPayload(
      alice.secrets.rendezvousId,
      'b',
      sealPublicKey(wrongSecrets, imposter.publicKey),
    );

    const result = await receivePeer(relay, alice, '222222', T0 + 1 * MINUTES);
    expect(result.state).toEqual({ step: 'failed', reason: 'mismatch' });
  });
});

describe('nothing secret ever reaches the relay', () => {
  test('relay payloads contain no private key, no public key in clear, no codes', async () => {
    const relay = createMemoryRelay();
    const codes: [string, string] = ['111111', '222222'];
    const alice = await reachExchange(relay, codes[0], codes[1], T0);
    const bob = await reachExchange(relay, codes[1], codes[0], T0);

    expect(relay.observed.length).toBe(2);
    for (const payload of relay.observed) {
      // Opaque shape only — the live worker enforces the same regex.
      expect(payload).toMatch(/^[A-Za-z0-9+/=_-]+$/);
      for (const client of [alice, bob]) {
        expect(payload).not.toContain(bytesToHex(client.keyPair.privateKey));
        expect(payload).not.toContain(bytesToHex(client.keyPair.publicKey));
        expect(payload).not.toContain(Buffer.from(client.keyPair.privateKey).toString('base64'));
        expect(payload).not.toContain(bytesToHex(client.secrets.sealingKey));
      }
      for (const code of codes) expect(payload).not.toContain(code);
      // Sealed bytes must not embed the raw key material either.
      const raw = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      for (const client of [alice, bob]) {
        expect(raw.includes(Buffer.from(client.keyPair.privateKey))).toBe(false);
        expect(raw.includes(Buffer.from(client.keyPair.publicKey))).toBe(false);
      }
    }
  });

  test('the sealed payload only opens with the right code-derived key', () => {
    const secrets = deriveSecrets('111111', '222222');
    const other = deriveSecrets('111111', '333333');
    const { publicKey } = generateKeyPair();
    const sealed = sealPublicKey(secrets, publicKey);
    expect(openPublicKey(secrets, sealed)).toEqual(publicKey);
    expect(openPublicKey(other, sealed)).toBeNull();
  });
});

describe('unpair', () => {
  test('wipes device keys and every remote blob for the pair', async () => {
    const relay = createMemoryRelay();
    const keystore = createMemoryKeystore();
    await keystore.save({ rootKeyHex: 'aa'.repeat(32), pairId: 'pair-under-test', word: 'acorn' });
    await relay.putEntry('pair-under-test', 'entry-1', 'Y2lwaGVydGV4dA==');
    await relay.putEntry('pair-under-test', 'entry-2', 'Y2lwaGVydGV4dA==');

    await unpair(keystore, relay);

    expect(keystore.contents()).toBeNull();
    expect(await relay.listEntries('pair-under-test')).toEqual([]);
    expect(await relay.getEntry('pair-under-test', 'entry-1')).toBeNull();
  });

  test('local keys are wiped even when the relay is unreachable', async () => {
    const keystore = createMemoryKeystore();
    await keystore.save({ rootKeyHex: 'bb'.repeat(32), pairId: 'gone', word: 'birch' });
    const deadRelay = {
      ...createMemoryRelay(),
      deletePair: async () => {
        throw new Error('offline');
      },
    };
    await unpair(keystore, deadRelay);
    expect(keystore.contents()).toBeNull();
  });
});

describe('pairing primitives', () => {
  test('codes are 6 digits and validated', () => {
    for (let i = 0; i < 20; i++) expect(isValidCode(generateCode())).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('abcdef')).toBe(false);
    expect(() => deriveSecrets('111111', '111111')).toThrow();
  });

  test('slot assignment is deterministic and opposite on the two phones', () => {
    expect(slotFor('111111', '222222')).toBe('a');
    expect(slotFor('222222', '111111')).toBe('b');
  });

  test('root key binds the ECDH result to the codes', () => {
    const secrets = deriveSecrets('111111', '222222');
    const otherSecrets = deriveSecrets('111111', '333333');
    const a = generateKeyPair();
    const b = generateKeyPair();
    const key1 = deriveRootKey(a.privateKey, b.publicKey, secrets);
    const key2 = deriveRootKey(b.privateKey, a.publicKey, secrets);
    expect(bytesToHex(key1)).toBe(bytesToHex(key2));
    const rebound = deriveRootKey(a.privateKey, b.publicKey, otherSecrets);
    expect(bytesToHex(rebound)).not.toBe(bytesToHex(key1));
  });

  test('confirmation word list is exactly 256 calm words', () => {
    expect(CONFIRMATION_WORDS.length).toBe(256);
    expect(new Set(CONFIRMATION_WORDS).size).toBe(256);
  });
});

describe('pairing state machine details', () => {
  test('typos and echoing your own code stay on the code screen', () => {
    const showing = startPairing('111111', T0);
    expect(reducePairing(showing, { type: 'submit-code', partnerCode: '12345', now: T0 }).state).toBe(
      showing,
    );
    expect(
      reducePairing(showing, { type: 'submit-code', partnerCode: '111111', now: T0 }).state,
    ).toBe(showing);
  });

  test('submitting after the window has closed fails as expired', () => {
    const showing = startPairing('111111', T0);
    const late = reducePairing(showing, {
      type: 'submit-code',
      partnerCode: '222222',
      now: T0 + 11 * MINUTES,
    });
    expect(late.state).toEqual({ step: 'failed', reason: 'expired' });
  });

  test('network errors fail safely and are retryable', () => {
    const showing = startPairing('111111', T0);
    const failed = reducePairing(showing, { type: 'network-error' });
    expect(failed.state).toEqual({ step: 'failed', reason: 'network' });
    const retried = reducePairing(failed.state, { type: 'retry', ownCode: '999999', now: T0 });
    expect(retried.state).toMatchObject({ step: 'showing', ownCode: '999999' });
  });

  test('ticks inside the window change nothing', () => {
    const showing = startPairing('111111', T0);
    expect(reducePairing(showing, { type: 'tick', now: T0 + 5 * MINUTES }).state).toBe(showing);
  });
});
