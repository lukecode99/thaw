import { INITIAL_NAV, NavState, reduceNav, showsTabBar, TABS } from '../navigation';

describe('navigation shell', () => {
  test('starts unpaired on welcome, no tab bar, pair mode', () => {
    expect(INITIAL_NAV.screen).toBe('welcome');
    expect(INITIAL_NAV.paired).toBe(false);
    expect(INITIAL_NAV.mode).toBe('pair');
    expect(showsTabBar(INITIAL_NAV)).toBe(false);
  });

  test('welcome → pair → home happy path', () => {
    let s = reduceNav(INITIAL_NAV, { type: 'get-started' });
    expect(s.screen).toBe('pair');
    s = reduceNav(s, { type: 'paired' });
    expect(s).toEqual({ screen: 'home', paired: true, mode: 'pair' });
    expect(showsTabBar(s)).toBe(true);
  });

  test('every tab is reachable once paired', () => {
    const home: NavState = { screen: 'home', paired: true, mode: 'pair' };
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

  test('back returns from pair to welcome in pair mode', () => {
    const pair: NavState = { screen: 'pair', paired: false, mode: 'pair' };
    expect(reduceNav(pair, { type: 'back' }).screen).toBe('welcome');
    const home: NavState = { screen: 'home', paired: true, mode: 'pair' };
    expect(reduceNav(home, { type: 'back' })).toEqual(home);
  });

  test('paired event only fires from pair screen', () => {
    expect(reduceNav(INITIAL_NAV, { type: 'paired' })).toEqual(INITIAL_NAV);
  });

  test('welcome and pair never show the tab bar', () => {
    expect(showsTabBar({ screen: 'welcome', paired: false, mode: 'pair' })).toBe(false);
    expect(showsTabBar({ screen: 'pair', paired: false, mode: 'pair' })).toBe(false);
  });
});

describe('solo mode', () => {
  test('start-solo from welcome → home, solo, unpaired', () => {
    const s = reduceNav(INITIAL_NAV, { type: 'start-solo' });
    expect(s).toEqual({ screen: 'home', paired: false, mode: 'solo' });
    expect(showsTabBar(s)).toBe(false);
  });

  test('start-solo is a no-op from non-welcome screens', () => {
    const pair: NavState = { screen: 'pair', paired: false, mode: 'pair' };
    expect(reduceNav(pair, { type: 'start-solo' })).toEqual(pair);
  });

  test('start-entry works in solo mode without pairing', () => {
    const home: NavState = { screen: 'home', paired: false, mode: 'solo' };
    const s = reduceNav(home, { type: 'start-entry' });
    expect(s.screen).toBe('entry');
    expect(s.mode).toBe('solo');
  });

  test('go-to-pair sends solo home to pair screen', () => {
    const home: NavState = { screen: 'home', paired: false, mode: 'solo' };
    const s = reduceNav(home, { type: 'go-to-pair' });
    expect(s.screen).toBe('pair');
    expect(s.mode).toBe('solo');
  });

  test('go-to-pair is a no-op from pair mode home', () => {
    const home: NavState = { screen: 'home', paired: true, mode: 'pair' };
    expect(reduceNav(home, { type: 'go-to-pair' })).toEqual(home);
  });

  test('back from pair screen returns to solo home in solo mode', () => {
    const pair: NavState = { screen: 'pair', paired: false, mode: 'solo' };
    const s = reduceNav(pair, { type: 'back' });
    expect(s.screen).toBe('home');
    expect(s.mode).toBe('solo');
  });

  test('paired event in solo mode transitions to pair mode home', () => {
    const pair: NavState = { screen: 'pair', paired: false, mode: 'solo' };
    const s = reduceNav(pair, { type: 'paired' });
    expect(s).toEqual({ screen: 'home', paired: true, mode: 'pair' });
  });

  test('solo home does not show tab bar', () => {
    const home: NavState = { screen: 'home', paired: false, mode: 'solo' };
    expect(showsTabBar(home)).toBe(false);
  });
});
