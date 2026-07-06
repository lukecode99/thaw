// Minimal, dependency-free navigation model. Pure functions so the shell's
// reachability can be unit-tested without rendering anything.

export type Screen = 'welcome' | 'pair' | 'home' | 'history' | 'settings';

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
  | { type: 'back' }; // Pair → Welcome

export function reduceNav(s: NavState, e: NavEvent): NavState {
  switch (e.type) {
    case 'get-started':
      return s.screen === 'welcome' ? { ...s, screen: 'pair' } : s;
    case 'paired':
      return s.screen === 'pair' ? { screen: 'home', paired: true } : s;
    case 'tab':
      return s.paired && TABS.includes(e.tab) ? { ...s, screen: e.tab } : s;
    case 'back':
      return s.screen === 'pair' ? { ...s, screen: 'welcome' } : s;
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
