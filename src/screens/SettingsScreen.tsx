import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME, NOT_PRO_ADVICE, PRIVACY_HEADLINE, PRIVACY_LINE, VERSION } from '../branding';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

export function SettingsScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Settings</Text>

      <Card title={PRIVACY_HEADLINE} tone="soft">
        <Text style={styles.body}>{PRIVACY_LINE}</Text>
      </Card>

      <Card title="A note on what this is">
        <Text style={styles.body}>{NOT_PRO_ADVICE}</Text>
      </Card>

      <Text style={styles.version}>
        {APP_NAME} {VERSION}
      </Text>
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
  version: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    marginTop: space.md,
    textAlign: 'center',
  },
});
