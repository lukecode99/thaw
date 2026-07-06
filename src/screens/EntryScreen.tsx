// The repair entry form: five prompts on one gentle scroll. The draft
// autosaves to the device as you type (never uploaded); submitting seals it
// with the pair key and locks it for good.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { emptyAnswers, isComplete, missingAnswers, PROMPTS, type EntryAnswers } from '../entries';
import type { EntryStore } from '../entryStore';
import { colors, font, space } from '../theme';

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
    if (!isComplete(answers)) {
      setShowMissing(true);
      return;
    }
    setBusy(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await store.submit(answers, rootKeyHex, Date.now());
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
  sealNote: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
  submit: {
    marginTop: space.sm,
  },
});
