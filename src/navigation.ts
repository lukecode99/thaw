// Minimal, dependency-free navigation model. Pure functions so the shell's
// reachability can be unit-tested without rendering anything.

export type Screen = 'welcome' | 'pair' | 'home' | 'history' | 'settings' | 'entry' | 'reveal';

export const TABS: readonly Screen[] = ['home', 'history', 'settings'] as const;

export interface NavState {
  screen: Screen;
  paired: boolean;
}

export const INITIAL_NAV: NavState = { screen: 'welcome', paired: false };

export type NavEvent =
  | { type: 'get-started' } // Welcome → Pair
  | { type: 'paired' } // Pair complete → Home
  | { type: 'tab'; tab: Screen } // bottom tab tap
  | { type: 'back' } // Pair → Welcome, Entry → Home
  | { type: 'start-entry' } // Home → Entry form
  | { type: 'entry-done' } // Entry submitted → Home
  | { type: 'open-reveal' } // Home → Reveal (only when both sides are in)
  | { type: 'reveal-done' } // Reveal → Home
  | { type: 'unpaired' }; // Unpair → Welcome, tabs locked again

export function reduceNav(s: NavState, e: NavEvent): NavState {
  switch (e.type) {
    case 'get-started':
      return s.screen === 'welcome' ? { ...s, screen: 'pair' } : s;
    case 'paired':
      return s.screen === 'pair' ? { screen: 'home', paired: true } : s;
    case 'tab':
      return s.paired && TABS.includes(e.tab) ? { ...s, screen: e.tab } : s;
    case 'back':
      if (s.screen === 'pair') return { ...s, screen: 'welcome' };
      if (s.screen === 'entry' || s.screen === 'reveal') return { ...s, screen: 'home' };
      return s;
    case 'start-entry':
      return s.paired && s.screen === 'home' ? { ...s, screen: 'entry' } : s;
    case 'entry-done':
      return s.screen === 'entry' ? { ...s, screen: 'home' } : s;
    case 'open-reveal':
      return s.paired && s.screen === 'home' ? { ...s, screen: 'reveal' } : s;
    case 'reveal-done':
      return s.screen === 'reveal' ? { ...s, screen: 'home' } : s;
    case 'unpaired':
      return s.paired ? { screen: 'welcome', paired: false } : s;
  }
}

export function showsTabBar(s: NavState): boolean {
  return s.paired && TABS.includes(s.screen);
}

export const TAB_LABELS: Record<string, string> = {
  home: 'Home',
  history: 'History',
  settings: 'Settings',
};
