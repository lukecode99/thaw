import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PAIR_EXPLAINER } from '../branding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { colors, font, space } from '../theme';

// Shell placeholder: real pair-code exchange and key agreement arrive with the
// pairing milestone. "Continue" simply advances the shell for now.
export function PairScreen({ onPaired, onBack }: { onPaired: () => void; onBack: () => void }) {
  const [code, setCode] = useState('');

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pair with your partner</Text>
      <Text style={styles.explainer}>{PAIR_EXPLAINER}</Text>

      <Card tone="soft" title="Your pair code">
        <Text style={styles.code}>— — — — — —</Text>
        <Text style={styles.hint}>A one-time code will appear here.</Text>
      </Card>

      <Input
        label="Or enter your partner's code"
        value={code}
        onChangeText={setCode}
        placeholder="6-character code"
        autoCapitalize="characters"
      />

      <Button label="Continue" onPress={onPaired} />
      <Button label="Back" variant="quiet" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: space.lg,
    justifyContent: 'center',
    padding: space.lg,
  },
  title: {
    color: colors.ink,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
  },
  explainer: {
    color: colors.inkSoft,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
  },
  code: {
    color: colors.ink,
    fontSize: font.size.xl,
    fontWeight: font.weight.medium,
    letterSpacing: 4,
  },
  hint: {
    color: colors.inkFaint,
    fontSize: font.size.sm,
    marginTop: space.sm,
  },
});
