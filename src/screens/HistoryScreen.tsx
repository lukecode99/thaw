// Past repairs, newest first, with a light patterns view on top. Everything
// shown here comes off the device — the relay is only touched when a repair
// is deleted, to remove our own blobs.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PromptPairs } from '../components/PromptPairs';
import { formatDay, PATTERNS_FRAMING, previewOf, tagFrequency, type HistoryRepair } from '../history';
import { colors, font, radius, space } from '../theme';

export function HistoryScreen({
  repairs,
  onDelete,
}: {
  repairs: HistoryRepair[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const frequencies = tagFrequency(repairs);
  const maxCount = frequencies[0]?.count ?? 1;

  const remove = async (id: string) => {
    await onDelete(id);
    setOpenId(null);
    setConfirmingId(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>History</Text>

      {repairs.length === 0 && (
        <Card tone="soft">
          <Text style={styles.body}>
            Past repairs will live here — stored only on your phones, nowhere else.
          </Text>
        </Card>
      )}

      {frequencies.length > 0 && (
        <Card title="Patterns" tone="soft">
          <Text style={styles.body}>{PATTERNS_FRAMING}</Text>
          <View style={styles.frequencyList}>
            {frequencies.map(({ tag, count }) => (
              <View key={tag} style={styles.frequencyRow}>
                <Text style={styles.frequencyTag}>{tag}</Text>
                <View style={styles.frequencyTrack}>
                  <View
                    style={[styles.frequencyBar, { width: `${(count / maxCount) * 100}%` }]}
                  />
                </View>
                <Text style={styles.frequencyCount}>{count}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {repairs.map((repair) => {
        const open = openId === repair.id;
        return (
          <Card key={repair.id}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setOpenId(open ? null : repair.id);
                setConfirmingId(null);
              }}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemDate}>{formatDay(repair.createdAt)}</Text>
                {!!repair.tag && (
                  <View style={styles.tagChip}>
                    <Text style={styles.tagChipText}>{repair.tag}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.preview}>{previewOf(repair.mine)}</Text>
            </Pressable>

            {open && (
              <View style={styles.detail}>
                <PromptPairs mine={repair.mine} theirs={repair.theirs} />
                {!repair.theirs && (
                  <Text style={styles.note}>
                    Your partner&apos;s side is not on this phone for this one.
                  </Text>
                )}
                {(repair.myClosing || repair.theirClosing) && (
                  <View style={styles.closings}>
                    {repair.myClosing && (
                      <Text style={styles.closingLine}>You took: {repair.myClosing}</Text>
                    )}
                    {repair.theirClosing && (
                      <Text style={styles.closingLine}>
                        Your partner took: {repair.theirClosing}
                      </Text>
                    )}
                  </View>
                )}
                {confirmingId === repair.id ? (
                  <View style={styles.confirmRow}>
                    <Text style={styles.note}>
                      This removes it from this phone and from the relay. Your partner&apos;s
                      copy is theirs.
                    </Text>
                    <Button
                      label="Yes, remove it"
                      variant="secondary"
                      onPress={() => remove(repair.id)}
                      style={styles.removeButton}
                    />
                  </View>
                ) : (
                  <Button
                    label="Remove this repair"
                    variant="quiet"
                    onPress={() => setConfirmingId(repair.id)}
                    style={styles.removeButton}
                  />
                )}
              </View>
            )}
          </Card>
        );
      })}
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
  frequencyList: {
    gap: space.sm,
    marginTop: space.md,
  },
  frequencyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  frequencyTag: {
    color: colors.ink,
    fontSize: font.size.sm,
    width: 120,
  },
  frequencyTrack: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.pill,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  frequencyBar: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 8,
  },
  frequencyCount: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    textAlign: 'right',
    width: 24,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.xs,
  },
  itemDate: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
  },
  tagChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  tagChipText: {
    color: colors.accent,
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
  },
  preview: {
    color: colors.ink,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.5,
  },
  detail: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: space.lg,
    marginTop: space.md,
    paddingTop: space.lg,
  },
  note: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    lineHeight: font.size.xs * 1.5,
  },
  closings: {
    gap: space.xs,
  },
  closingLine: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    fontStyle: 'italic',
    lineHeight: font.size.sm * 1.5,
  },
  confirmRow: {
    gap: space.sm,
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
});
