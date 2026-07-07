// Both sides of a repair, prompt by prompt — side by side on wide screens,
// stacked on phones. Shared between the reveal itself and history details.
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { PROMPTS, type EntryAnswers } from '../entries';
import { colors, font, radius, space } from '../theme';

const WIDE_BREAKPOINT = 480;

export function PromptPairs({
  mine,
  theirs,
}: {
  mine: EntryAnswers;
  theirs: EntryAnswers | null;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <View style={styles.list}>
      {PROMPTS.map((prompt) => (
        <View key={prompt.key} style={styles.section}>
          <Text style={styles.promptTitle}>{prompt.title}</Text>
          <View style={[styles.pair, wide && styles.pairWide]}>
            <View style={[styles.side, styles.sideMine]}>
              <Text style={styles.sideLabel}>You</Text>
              <Text style={styles.answer}>{mine[prompt.key]}</Text>
            </View>
            {theirs && (
              <View style={[styles.side, styles.sideTheirs]}>
                <Text style={[styles.sideLabel, styles.sideLabelTheirs]}>Your partner</Text>
                <Text style={styles.answer}>{theirs[prompt.key]}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.xl,
  },
  section: {
    gap: space.md,
  },
  promptTitle: {
    color: colors.ink,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    lineHeight: font.size.lg * 1.3,
  },
  pair: {
    gap: space.md,
  },
  pairWide: {
    flexDirection: 'row',
  },
  side: {
    borderRadius: radius.md,
    flex: 1,
    gap: space.xs,
    padding: space.md,
  },
  sideMine: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  sideTheirs: {
    backgroundColor: colors.accentSoft,
  },
  sideLabel: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sideLabelTheirs: {
    color: colors.accent,
  },
  answer: {
    color: colors.ink,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.6,
  },
});
