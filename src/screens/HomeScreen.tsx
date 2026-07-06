import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

// Shell placeholder showing the three states a repair can be in. The real
// states become data-driven once forms and sync exist.
export function HomeScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Home</Text>

      <Card title="Start a repair">
        <Text style={styles.body}>
          Had a rough moment? Write down your side privately — your partner does the same.
        </Text>
        <Button label="New repair" onPress={() => {}} style={styles.action} />
      </Card>

      <Card title="Waiting" tone="soft">
        <Text style={styles.body}>
          You have submitted your answers. They stay sealed until your partner finishes too.
        </Text>
      </Card>

      <Card title="Reveal ready" tone="ready">
        <Text style={styles.body}>
          You have both finished. Open the reveal together when you are ready.
        </Text>
        <Button label="Open reveal" variant="secondary" onPress={() => {}} style={styles.action} />
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
  body: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingVertical: space.sm,
  },
});
