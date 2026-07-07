import { soloPhase } from '../soloPhase';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('soloPhase', () => {
  const now = 1_000_000_000_000; // arbitrary fixed epoch ms

  test('no entry → no-entry', () => {
    expect(soloPhase(null, now)).toBe('no-entry');
  });

  test('entry written just now → cool-down', () => {
    expect(soloPhase(now, now)).toBe('cool-down');
  });

  test('entry written 29 min ago → cool-down', () => {
    expect(soloPhase(now - 29 * MINUTE, now)).toBe('cool-down');
  });

  test('entry written exactly 30 min ago → invite', () => {
    expect(soloPhase(now - 30 * MINUTE, now)).toBe('invite');
  });

  test('entry written 12 h ago → invite', () => {
    expect(soloPhase(now - 12 * HOUR, now)).toBe('invite');
  });

  test('entry written exactly 48 h ago → solo-reflection', () => {
    expect(soloPhase(now - 48 * HOUR, now)).toBe('solo-reflection');
  });

  test('entry written 72 h ago → solo-reflection', () => {
    expect(soloPhase(now - 72 * HOUR, now)).toBe('solo-reflection');
  });
});
