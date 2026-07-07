// The repair entry form: five prompts on one gentle scroll, plus a topic to
// file it under. The draft autosaves to the device as you type (never
// uploaded); submitting seals it with the pair key and locks it for good.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import {
  emptyAnswers,
  isComplete,
  missingAnswers,
  PROMPTS,
  TOPICS,
  type EntryAnswers,
} from '../entries';
import type { EntryStore } from '../entryStore';
import { colors, font, radius, space } from '../theme';

const AUTOSAVE_DELAY_MS = 600;

export function EntryScreen({
  store,
  rootKeyHex,
  onSubmitted,
  onBack,
}: {
  store: EntryStore;
  rootKeyHex: string;
  onSubmitted: () => void;
  onBack: () => void;
}) {
  const [answers, setAnswers] = useState<EntryAnswers>(emptyAnswers());
  const [tag, setTag] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    store.loadDraft().then((draft) => {
      if (draft) setAnswers(draft);
      setLoaded(true);
    });
  }, [store]);

  const update = (key: keyof EntryAnswers, text: string) => {
    const next = { ...answers, [key]: text };
    setAnswers(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => store.saveDraft(next), AUTOSAVE_DELAY_MS);
  };

  const submit = async () => {
    if (!isComplete(answers) || !tag) {
      setShowMissing(true);
      return;
    }
    setBusy(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await store.submit(answers, tag, rootKeyHex, Date.now());
    onSubmitted();
  };

  if (!loaded) return null;

  const missing = new Set(missingAnswers(answers));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Your side of it</Text>
      <Text style={styles.intro}>
        Take your time — this stays on your phone while you write. Your partner sees nothing
        until you both finish.
      </Text>

      {PROMPTS.map((prompt) => (
        <View key={prompt.key}>
          <Input
            label={prompt.title}
            value={answers[prompt.key]}
            onChangeText={(text) => update(prompt.key, text)}
            placeholder={prompt.hint}
            autoCapitalize="sentences"
            multiline
          />
          {showMissing && missing.has(prompt.key) && (
            <Text style={styles.nudge}>A few words here before you send.</Text>
          )}
        </View>
      ))}

      <View>
        <Text style={styles.tagLabel}>What was this one about?</Text>
        <View style={styles.tagRow}>
          {TOPICS.map((topic) => (
            <Pressable
              key={topic}
              accessibilityRole="button"
              onPress={() => setTag(topic)}
              style={[styles.tagChip, tag === topic && styles.tagChipActive]}
            >
              <Text style={[styles.tagText, tag === topic && styles.tagTextActive]}>{topic}</Text>
            </Pressable>
          ))}
        </View>
        {showMissing && !tag && <Text style={styles.nudge}>Pick a topic before you send.</Text>}
      </View>

      <Card tone="soft">
        <Text style={styles.sealNote}>
          Sending seals your answers. You can read them again, but not change them.
        </Text>
      </Card>

      <Button
        label={busy ? 'Sealing…' : 'Seal and send'}
        onPress={submit}
        disabled={busy}
        style={styles.submit}
      />
      <Button label="Save and come back later" variant="quiet" onPress={onBack} />
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
  },
  intro: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
    marginBottom: space.sm,
  },
  nudge: {
    color: colors.accent,
    fontSize: font.size.xs,
    marginTop: space.xs,
  },
  tagLabel: {
    color: colors.ink,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    marginBottom: space.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tagChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  tagChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  tagText: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
  },
  tagTextActive: {
    color: colors.accent,
    fontWeight: font.weight.medium,
  },
  sealNote: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
  submit: {
    marginTop: space.sm,
  },
});
