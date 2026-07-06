import * as fs from 'fs';
import * as path from 'path';

// Success criteria for the relay live in relay/worker.js. This guard keeps the
// privacy-critical constants honest without needing a network: sessions expire
// within 10 minutes, blobs carry a TTL, payloads are size-capped, and the
// worker never parses payload bodies — it stores opaque strings only.
const source = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'relay', 'worker.js'),
  'utf8',
);

describe('relay source guard', () => {
  test('pairing sessions expire within 10 minutes', () => {
    const match = source.match(/const PAIR_TTL = (\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(600);
    expect(source).toMatch(/expirationTtl: PAIR_TTL/);
  });

  test('ciphertext blobs carry a TTL', () => {
    expect(source).toMatch(/const BLOB_TTL = 30 \* 86400/);
    expect(source).toMatch(/expirationTtl: BLOB_TTL/);
  });

  test('payloads are size-capped', () => {
    expect(source).toMatch(/const MAX_BODY = 64 \* 1024/);
    expect(source).toMatch(/too_large/);
  });

  test('payloads stay opaque — never parsed, shape-checked before storage', () => {
    expect(source).toMatch(/OPAQUE\.test\(text\)/);
    // request.json() would mean the relay is reading payload contents.
    expect(source).not.toMatch(/request\.json\(/);
  });

  test('rate limiting exists per pair/session id', () => {
    expect(source).toMatch(/const RATE_LIMIT = \d+/);
    expect(source).toMatch(/rate_limited/);
  });
});
