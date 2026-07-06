import './src/polyfills';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useReducer } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RELAY_URL } from './src/config';
import { createHttpRelay } from './src/crypto/relay';
import { createDeviceKeystore, unpair } from './src/keystore';
import { INITIAL_NAV, reduceNav, showsTabBar, TAB_LABELS, TABS } from './src/navigation';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PairScreen } from './src/screens/PairScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, font, space } from './src/theme';

const relay = createHttpRelay(RELAY_URL);
const keystore = createDeviceKeystore();

export default function App() {
  const [nav, dispatch] = useReducer(reduceNav, INITIAL_NAV);

  // A phone that already holds pair keys goes straight to Home.
  useEffect(() => {
    keystore.load().then((pair) => {
      if (pair) {
        dispatch({ type: 'get-started' });
        dispatch({ type: 'paired' });
      }
    });
  }, []);

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
            onPaired={() => dispatch({ type: 'paired' })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {nav.screen === 'home' && <HomeScreen />}
        {nav.screen === 'history' && <HistoryScreen />}
        {nav.screen === 'settings' && (
          <SettingsScreen
            onUnpair={() => unpair(keystore, relay).then(() => dispatch({ type: 'unpaired' }))}
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
