import { INITIAL_NAV, NavState, reduceNav, showsTabBar, TABS } from '../navigation';

describe('navigation shell', () => {
  test('starts unpaired on welcome, no tab bar', () => {
    expect(INITIAL_NAV.screen).toBe('welcome');
    expect(INITIAL_NAV.paired).toBe(false);
    expect(showsTabBar(INITIAL_NAV)).toBe(false);
  });

  test('welcome → pair → home happy path', () => {
    let s = reduceNav(INITIAL_NAV, { type: 'get-started' });
    expect(s.screen).toBe('pair');
    s = reduceNav(s, { type: 'paired' });
    expect(s).toEqual({ screen: 'home', paired: true });
    expect(showsTabBar(s)).toBe(true);
  });

  test('every tab is reachable once paired', () => {
    const home: NavState = { screen: 'home', paired: true };
    for (const tab of TABS) {
      const s = reduceNav(home, { type: 'tab', tab });
      expect(s.screen).toBe(tab);
      expect(showsTabBar(s)).toBe(true);
    }
  });

  test('tabs are locked until paired', () => {
    for (const tab of TABS) {
      expect(reduceNav(INITIAL_NAV, { type: 'tab', tab })).toEqual(INITIAL_NAV);
    }
  });

  test('back returns from pair to welcome only', () => {
    const pair: NavState = { screen: 'pair', paired: false };
    expect(reduceNav(pair, { type: 'back' }).screen).toBe('welcome');
    const home: NavState = { screen: 'home', paired: true };
    expect(reduceNav(home, { type: 'back' })).toEqual(home);
  });

  test('paired event only fires from pair screen', () => {
    expect(reduceNav(INITIAL_NAV, { type: 'paired' })).toEqual(INITIAL_NAV);
  });

  test('welcome and pair never show the tab bar', () => {
    expect(showsTabBar({ screen: 'welcome', paired: false })).toBe(false);
    expect(showsTabBar({ screen: 'pair', paired: false })).toBe(false);
  });
});
