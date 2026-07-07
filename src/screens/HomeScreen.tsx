import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PROMPTS, type EntryAnswers } from '../entries';
import { SIGNAL_COPY } from '../notifications';
import type { RevealPhase } from '../reveal';
import type { SoloPhase } from '../soloPhase';
import { colors, font, space } from '../theme';

export function HomeScreen({
  reveal,
  queued,
  partnerWaiting = false,
  onStartRepair,
  onOpenReveal,
  onRetry,
  mode = 'pair',
  solophase,
  soloEntry,
  onStartPairing,
}: {
  reveal: RevealPhase;
  queued: boolean;
  partnerWaiting?: boolean;
  onStartRepair: () => void;
  onOpenReveal: () => void;
  onRetry: () => void;
  mode?: 'pair' | 'solo';
  solophase?: SoloPhase;
  soloEntry?: EntryAnswers | null;
  onStartPairing?: () => void;
}) {
  const [reading, setReading] = useState(false);

  if (mode === 'solo') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Home</Text>

        {solophase === 'no-entry' && (
          <Card title="Write your side">
            <Text style={styles.body}>
              Write down how the argument felt — privately, on your own. No partner needed yet.
            </Text>
            <Button label="Start writing" onPress={onStartRepair} style={styles.action} />
          </Card>
        )}

        {solophase === 'cool-down' && (
          <Card title="Thoughts captured" tone="soft">
            <Text style={styles.body}>
              Your side is saved. Give yourself a little time before reaching out.
            </Text>
          </Card>
        )}

        {solophase === 'invite' && (
          <Card title="Ready to hear their side?" tone="ready">
            <Text style={styles.body}>
              When you feel ready, invite your partner to write their response.
            </Text>
            {onStartPairing && (
              <Button
                label="Connect with partner"
                onPress={onStartPairing}
                style={styles.action}
              />
            )}
          </Card>
        )}

        {solophase === 'solo-reflection' && (
          <Card title="Your reflection" tone="soft">
            <Text style={styles.body}>
              You wrote your side a while ago. You can still invite your partner, or read back
              what you wrote below.
            </Text>
            {onStartPairing && (
              <Button
                label="Connect with partner"
                variant="secondary"
                onPress={onStartPairing}
                style={styles.action}
              />
            )}
            {soloEntry &&
              PROMPTS.map((prompt) => (
                <View key={prompt.key} style={styles.readBlock}>
                  <Text style={styles.readTitle}>{prompt.title}</Text>
                  <Text style={styles.body}>{soloEntry[prompt.key]}</Text>
                </View>
              ))}
          </Card>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Home</Text>

      {reveal.phase === 'no-entry' && partnerWaiting && (
        <Card title={SIGNAL_COPY['partner-wrote'].title} tone="ready">
          <Text style={styles.body}>{SIGNAL_COPY['partner-wrote'].body}</Text>
          <Button label="Write my side" onPress={onStartRepair} style={styles.action} />
        </Card>
      )}

      {reveal.phase === 'no-entry' && !partnerWaiting && (
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
