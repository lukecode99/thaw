import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PROMPTS, type RepairEntry } from '../entries';
import { colors, font, space } from '../theme';

export function HomeScreen({
  latestEntry,
  queued,
  onStartRepair,
}: {
  latestEntry: RepairEntry | null;
  queued: boolean;
  onStartRepair: () => void;
}) {
  const [reading, setReading] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Home</Text>

      {latestEntry ? (
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
                <Text style={styles.body}>{latestEntry.answers[prompt.key]}</Text>
              </View>
            ))}
        </Card>
      ) : (
        <Card title="Start a repair">
          <Text style={styles.body}>
            Had a rough moment? Write down your side privately — your partner does the same.
          </Text>
          <Button label="New repair" onPress={onStartRepair} style={styles.action} />
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
