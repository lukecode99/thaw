// Solo-mode phase derivation. Pure function — no side effects, no imports.
// Used by App.tsx to decide which HomeScreen card to show when mode === 'solo'.
//
// Phases:
//   no-entry       — user has not yet written their side
//   cool-down      — entry written < 30 min ago; too soon to reach out
//   invite         — 30 min–48 h window; prompt to invite partner
//   solo-reflection — > 48 h; entry is now a personal record, invite still available

export type SoloPhase = 'no-entry' | 'cool-down' | 'invite' | 'solo-reflection';

const COOL_DOWN_MS = 30 * 60 * 1000;           // 30 min before invite prompt
const INVITE_WINDOW_MS = 48 * 60 * 60 * 1000;  // 48 h before degrading to reflection

export function soloPhase(entryCreatedAt: number | null, now: number): SoloPhase {
  if (entryCreatedAt === null) return 'no-entry';
  const age = now - entryCreatedAt;
  if (age < COOL_DOWN_MS) return 'cool-down';
  if (age < INVITE_WINDOW_MS) return 'invite';
  return 'solo-reflection';
}
