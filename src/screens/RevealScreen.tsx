// The reveal — the moment the app exists for. Both sides, prompt by prompt,
// side by side on wide screens and stacked on phones. Ends with one optional
// closing line each. Paced with generous whitespace: one prompt at a time,
// never a wall of text.
import React, { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import type { EntryPlaintext } from '../crypto/entries';
import { PROMPTS, type RepairEntry } from '../entries';
import { colors, font, radius, space } from '../theme';

const WIDE_BREAKPOINT = 480;

export function RevealScreen({
  mine,
  theirs,
  myClosing,
  theirClosing,
  onSaveClosing,
  onDone,
}: {
  mine: RepairEntry;
  theirs: EntryPlaintext;
  myClosing: string | null;
  theirClosing: string | null;
  onSaveClosing: (text: string) => Promise<void>;
  onDone: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const saveClosing = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await onSaveClosing(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Read together</Text>
      <Text style={styles.intro}>
        You both finished. Take a breath and go slowly — each of you wrote this for the other.
      </Text>

      {PROMPTS.map((prompt) => (
        <View key={prompt.key} style={styles.section}>
          <Text style={styles.promptTitle}>{prompt.title}</Text>
          <View style={[styles.pair, wide && styles.pairWide]}>
            <View style={[styles.side, styles.sideMine]}>
              <Text style={styles.sideLabel}>You</Text>
              <Text style={styles.answer}>{mine.answers[prompt.key]}</Text>
            </View>
            <View style={[styles.side, styles.sideTheirs]}>
              <Text style={[styles.sideLabel, styles.sideLabelTheirs]}>Your partner</Text>
              <Text style={styles.answer}>{theirs.answers[prompt.key]}</Text>
            </View>
          </View>
        </View>
      ))}

      <View style={styles.closingBlock}>
        <Text style={styles.promptTitle}>What are you taking from this?</Text>
        <Text style={styles.closingHint}>One line, if you want. It is shared when you save it.</Text>

        {myClosing ? (
          <Card tone="ready">
            <Text style={styles.sideLabel}>You</Text>
            <Text style={styles.answer}>{myClosing}</Text>
          </Card>
        ) : (
          <>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="I'm taking away…"
              autoCapitalize="sentences"
              multiline
            />
            <Button
              label={saving ? 'Saving…' : 'Share this line'}
              onPress={saveClosing}
              disabled={saving || !draft.trim()}
              style={styles.saveButton}
            />
          </>
        )}

        {theirClosing ? (
          <Card tone="ready" style={styles.theirClosing}>
            <Text style={styles.sideLabel}>Your partner</Text>
            <Text style={styles.answer}>{theirClosing}</Text>
          </Card>
        ) : (
          <Text style={styles.closingPending}>
            If your partner adds a line, it will appear here.
          </Text>
        )}
      </View>

      <Button label="Back to Home" variant="quiet" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: space.xl,
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  title: {
    color: colors.ink,
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
  },
  intro: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.6,
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
  closingBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: space.md,
    paddingTop: space.xl,
  },
  closingHint: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
  },
  saveButton: {
    alignSelf: 'flex-start',
  },
  theirClosing: {
    marginTop: space.sm,
  },
  closingPending: {
    color: colors.inkFaint,
    fontSize: font.size.sm,
  },
});
