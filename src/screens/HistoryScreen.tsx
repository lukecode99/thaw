import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

export function HistoryScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>History</Text>
      <Card tone="soft">
        <Text style={styles.empty}>
          Past repairs will live here — stored only on your phones, nowhere else.
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: space.lg,
    padding: space.lg,
  },
  title: {
    color: colors.ink,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
    marginBottom: space.sm,
  },
  empty: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
});
