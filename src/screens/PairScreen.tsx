import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { PAIR_EXPLAINER } from '../branding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import type { Relay } from '../crypto/relay';
import type { Keystore } from '../keystore';
import { FAILURE_MESSAGES } from '../pairingMachine';
import { colors, font, space } from '../theme';
import { usePairing } from '../usePairing';

const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

export function PairScreen({
  relay,
  keystore,
  onPaired,
  onBack,
}: {
  relay: Relay;
  keystore: Keystore;
  onPaired: () => void;
  onBack: () => void;
}) {
  const { state, submitCode, confirm, retry } = usePairing(relay, keystore, onPaired);
  const [typed, setTyped] = useState('');

  if (state.step === 'failed') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Let’s try that again</Text>
        <Text style={styles.explainer}>{FAILURE_MESSAGES[state.reason]}</Text>
        <Button label="Try again" onPress={() => { setTyped(''); retry(); }} />
        <Button label="Back" variant="quiet" onPress={onBack} />
      </View>
    );
  }

  if (state.step === 'confirming' || state.step === 'paired') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>One last check</Text>
        <Card tone="ready" title="Your confirmation word">
          <Text style={styles.word}>{state.word}</Text>
        </Card>
        <Text style={styles.explainer}>
          Say it out loud — you should both see the same word. If the words differ, start over.
        </Text>
        <Button label="We see the same word" onPress={confirm} />
        <Button label="Start over" variant="quiet" onPress={() => { setTyped(''); retry(); }} />
      </View>
    );
  }

  const busy = state.step === 'deriving' || state.step === 'exchanging';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Pair with your partner</Text>
      <Text style={styles.explainer}>{PAIR_EXPLAINER}</Text>

      <Card tone="soft" title="Your code">
        <Text style={styles.code}>{formatCode(state.ownCode)}</Text>
        <Text style={styles.hint}>Read it to your partner. It lasts ten minutes.</Text>
      </Card>

      <Input
        label="Your partner’s code"
        value={typed}
        onChangeText={setTyped}
        placeholder="6 digits"
        keyboardType="number-pad"
        maxLength={6}
        editable={!busy}
      />

      {busy ? (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>
            {state.step === 'deriving' ? 'Linking your codes…' : 'Waiting for your partner…'}
          </Text>
        </View>
      ) : (
        <Button
          label="Continue"
          onPress={() => submitCode(typed)}
          disabled={typed.trim().length !== 6}
        />
      )}
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
    fontSize: font.size.title,
    fontWeight: font.weight.medium,
    letterSpacing: 6,
  },
  word: {
    color: colors.ink,
    fontSize: font.size.title,
    fontWeight: font.weight.semibold,
  },
  hint: {
    color: colors.inkFaint,
    fontSize: font.size.sm,
    marginTop: space.sm,
  },
  waiting: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.md,
  },
});
