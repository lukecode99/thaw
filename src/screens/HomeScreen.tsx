import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PROMPTS } from '../entries';
import type { RevealPhase } from '../reveal';
import { colors, font, space } from '../theme';

export function HomeScreen({
  reveal,
  queued,
  onStartRepair,
  onOpenReveal,
  onRetry,
}: {
  reveal: RevealPhase;
  queued: boolean;
  onStartRepair: () => void;
  onOpenReveal: () => void;
  onRetry: () => void;
}) {
  const [reading, setReading] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Home</Text>

      {reveal.phase === 'no-entry' && (
        <Card title="Start a repair">
          <Text style={styles.body}>
            Had a rough moment? Write down your side privately — your partner does the same.
          </Text>
          <Button label="New repair" onPress={onStartRepair} style={styles.action} />
        </Card>
      )}

      {reveal.phase === 'waiting' && (
        <Card title="Waiting for your partner" tone="soft">
          <Text style={styles.body}>
            Your answers are sealed. They stay that way until your partner finishes their side —
            then you open them together.
          </Text>
          {queued && (
            <Text style={styles.queuedNote}>
              You are offline right now — your sealed answers will finish sending on their own.
            </Text>
          )}
          <Button
            label={reading ? 'Close' : 'Read what you wrote'}
            variant="quiet"
            onPress={() => setReading((r) => !r)}
            style={styles.action}
          />
          {reading &&
            PROMPTS.map((prompt) => (
              <View key={prompt.key} style={styles.readBlock}>
                <Text style={styles.readTitle}>{prompt.title}</Text>
                <Text style={styles.body}>{reveal.mine.answers[prompt.key]}</Text>
              </View>
            ))}
        </Card>
      )}

      {reveal.phase === 'trouble' && (
        <Card title="One moment" tone="soft">
          <Text style={styles.body}>
            We could not open your partner&apos;s side just now. Nothing is lost — it is safe
            where it is. Try again in a moment.
          </Text>
          <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.action} />
        </Card>
      )}

      {reveal.phase === 'ready' && (
        <Card title="You both finished" tone="ready">
          <Text style={styles.body}>
            Your partner&apos;s side is here. Find a quiet moment and open it together.
          </Text>
          <Button label="Open the reveal" onPress={onOpenReveal} style={styles.action} />
        </Card>
      )}
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
  queuedNote: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    marginTop: space.sm,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingVertical: space.sm,
  },
  readBlock: {
    marginTop: space.md,
  },
  readTitle: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    marginBottom: space.xs,
  },
});
