import './src/polyfills';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RELAY_URL } from './src/config';
import { createHttpRelay } from './src/crypto/relay';
import { type RepairEntry } from './src/entries';
import { createDeviceStorage, createEncryptedStorage, createEntryStore } from './src/entryStore';
import { type HistoryRepair } from './src/history';
import { createDeviceKeystore, unpair, type StoredPair } from './src/keystore';
import { INITIAL_NAV, reduceNav, showsTabBar, TAB_LABELS, TABS } from './src/navigation';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from './src/settings';
import { EntryScreen } from './src/screens/EntryScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PairScreen } from './src/screens/PairScreen';
import { RevealScreen } from './src/screens/RevealScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { useNotifications } from './src/useNotifications';
import { useReveal } from './src/useReveal';
import { colors, font, space } from './src/theme';

const relay = createHttpRelay(RELAY_URL);
const keystore = createDeviceKeystore();
const deviceStorage = createDeviceStorage();

export default function App() {
  const [nav, dispatch] = useReducer(reduceNav, INITIAL_NAV);
  const [pair, setPair] = useState<StoredPair | null>(null);
  const [entries, setEntries] = useState<RepairEntry[]>([]);
  const [history, setHistory] = useState<HistoryRepair[]>([]);
  const [queued, setQueued] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Nothing rests on the device in the clear: local storage is sealed with a
  // key derived from the pair root key, so the stores exist only once paired.
  const encryptedStorage = useMemo(
    () => (pair ? createEncryptedStorage(deviceStorage, pair.rootKeyHex) : null),
    [pair],
  );
  const entryStore = useMemo(
    () => (encryptedStorage ? createEntryStore(encryptedStorage) : null),
    [encryptedStorage],
  );
  const settingsStore = useMemo(
    () => (encryptedStorage ? createSettingsStore(encryptedStorage) : null),
    [encryptedStorage],
  );

  useEffect(() => {
    if (settingsStore) {
      settingsStore.load().then(setSettings);
    } else {
      setSettings(DEFAULT_SETTINGS);
    }
  }, [settingsStore]);

  const toggleNotifications = useCallback(() => {
    setSettings((current) => {
      const next = { ...current, notifications: !current.notifications };
      settingsStore?.save(next);
      return next;
    });
  }, [settingsStore]);

  const refreshEntries = useCallback(async () => {
    if (!entryStore || !pair) return;
    setEntries(await entryStore.listSubmitted());
    await entryStore.flushQueue(relay, pair.pairId, pair.slot);
    setEntries(await entryStore.listSubmitted());
    setQueued(await entryStore.hasQueued());
    setHistory(await entryStore.loadHistory());
  }, [entryStore, pair]);

  // A phone that already holds pair keys goes straight to Home; anything
  // still queued from an offline submit gets another shot at the relay.
  useEffect(() => {
    keystore.load().then((stored) => {
      if (stored) {
        setPair(stored);
        dispatch({ type: 'get-started' });
        dispatch({ type: 'paired' });
      }
    });
  }, []);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  const handlePaired = useCallback(() => {
    keystore.load().then(setPair);
    dispatch({ type: 'paired' });
  }, []);

  const handleSubmitted = useCallback(() => {
    dispatch({ type: 'entry-done' });
    refreshEntries();
  }, [refreshEntries]);

  const { reveal, refresh, saveClosing } = useReveal(
    relay,
    entryStore,
    pair?.pairId ?? null,
    pair?.slot ?? null,
    pair?.rootKeyHex ?? null,
    entries[0] ?? null,
  );

  const { partnerWaiting } = useNotifications({
    relay,
    store: entryStore,
    pairId: pair?.pairId ?? null,
    slot: pair?.slot ?? null,
    mineSubmitted: entries.length > 0,
    revealReady: reveal.phase === 'ready',
    enabled: settings.notifications,
  });

  // The reveal screen only exists while both sides are open-able.
  useEffect(() => {
    if (nav.screen === 'reveal' && reveal.phase !== 'ready') {
      dispatch({ type: 'reveal-done' });
    }
  }, [nav.screen, reveal.phase]);

  // Keep history fresh when entering the tab (the reveal may have cached the
  // partner's side since the last load).
  useEffect(() => {
    if (nav.screen === 'history' && entryStore) {
      entryStore.loadHistory().then(setHistory);
    }
  }, [nav.screen, entryStore, reveal.phase]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!entryStore || !pair) return;
      await entryStore.deleteEntry(id, relay, pair.pairId, pair.slot);
      await refreshEntries();
    },
    [entryStore, pair, refreshEntries],
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {nav.screen === 'welcome' && (
          <WelcomeScreen onGetStarted={() => dispatch({ type: 'get-started' })} />
        )}
        {nav.screen === 'pair' && (
          <PairScreen
            relay={relay}
            keystore={keystore}
            onPaired={handlePaired}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {nav.screen === 'home' && (
          <HomeScreen
            reveal={reveal}
            queued={queued}
            partnerWaiting={partnerWaiting}
            onStartRepair={() => dispatch({ type: 'start-entry' })}
            onOpenReveal={() => dispatch({ type: 'open-reveal' })}
            onRetry={refresh}
          />
        )}
        {nav.screen === 'reveal' && reveal.phase === 'ready' && (
          <RevealScreen
            mine={reveal.mine}
            theirs={reveal.theirs}
            myClosing={reveal.myClosing}
            theirClosing={reveal.theirClosing}
            onSaveClosing={saveClosing}
            onDone={() => dispatch({ type: 'reveal-done' })}
          />
        )}
        {nav.screen === 'entry' && pair && entryStore && (
          <EntryScreen
            store={entryStore}
            rootKeyHex={pair.rootKeyHex}
            onSubmitted={handleSubmitted}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {nav.screen === 'history' && <HistoryScreen repairs={history} onDelete={handleDelete} />}
        {nav.screen === 'settings' && (
          <SettingsScreen
            notificationsEnabled={settings.notifications}
            onToggleNotifications={toggleNotifications}
            onUnpair={() =>
              unpair(keystore, relay).then(() => {
                setPair(null);
                setEntries([]);
                setHistory([]);
                dispatch({ type: 'unpaired' });
              })
            }
          />
        )}
      </ScrollView>

      {showsTabBar(nav) && (
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'tab', tab })}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, nav.screen === tab && styles.tabLabelActive]}>
                {TAB_LABELS[tab]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    marginHorizontal: 'auto',
    maxWidth: 560,
    width: '100%',
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: space.md,
  },
  tabLabel: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: font.weight.semibold,
  },
});
