import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME, PRIVACY_HEADLINE, PRIVACY_LINE, TAGLINE, WELCOME_INTRO } from '../branding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
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

      <Button label="Get started" onPress={onGetStarted} style={styles.cta} />
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
});
