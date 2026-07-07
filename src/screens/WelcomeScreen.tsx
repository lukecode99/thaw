import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  APP_NAME,
  CRISIS_LINE,
  PRIVACY_HEADLINE,
  PRIVACY_LINE,
  TAGLINE,
  WELCOME_INTRO,
} from '../branding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

export function WelcomeScreen({
  onGetStarted,
  onStartSolo,
}: {
  onGetStarted: () => void;
  onStartSolo: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <Text style={styles.name}>{APP_NAME}</Text>
        <Text style={styles.tagline}>{TAGLINE}</Text>
        <Text style={styles.intro}>{WELCOME_INTRO}</Text>
      </View>

      <Card title={PRIVACY_HEADLINE} tone="soft">
        <Text style={styles.privacy}>{PRIVACY_LINE}</Text>
      </Card>

      <Button label="Start with partner" onPress={onGetStarted} style={styles.cta} />
      <Button label="Write alone first" variant="secondary" onPress={onStartSolo} />

      <Text style={styles.crisis}>{CRISIS_LINE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: space.xl,
    justifyContent: 'center',
    padding: space.lg,
  },
  hero: {
    gap: space.md,
  },
  name: {
    color: colors.ink,
    fontSize: font.size.title,
    fontWeight: font.weight.semibold,
  },
  tagline: {
    color: colors.accent,
    fontSize: font.size.lg,
    fontWeight: font.weight.medium,
    lineHeight: font.size.lg * 1.3,
  },
  intro: {
    color: colors.inkSoft,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
  },
  privacy: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
  cta: {
    marginTop: space.md,
  },
  crisis: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    lineHeight: font.size.xs * 1.5,
    textAlign: 'center',
  },
});
