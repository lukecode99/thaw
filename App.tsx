import { StatusBar } from 'expo-status-bar';
import React, { useReducer } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { INITIAL_NAV, reduceNav, showsTabBar, TAB_LABELS, TABS } from './src/navigation';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { PairScreen } from './src/screens/PairScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, font, space } from './src/theme';

export default function App() {
  const [nav, dispatch] = useReducer(reduceNav, INITIAL_NAV);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {nav.screen === 'welcome' && (
          <WelcomeScreen onGetStarted={() => dispatch({ type: 'get-started' })} />
        )}
        {nav.screen === 'pair' && (
          <PairScreen
            onPaired={() => dispatch({ type: 'paired' })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {nav.screen === 'home' && <HomeScreen />}
        {nav.screen === 'history' && <HistoryScreen />}
        {nav.screen === 'settings' && <SettingsScreen />}
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
