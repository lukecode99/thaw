import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { APP_NAME, NOT_PRO_ADVICE, PRIVACY_HEADLINE, PRIVACY_LINE, VERSION } from '../branding';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, font, space } from '../theme';

export function SettingsScreen({
  onUnpair,
  notificationsEnabled,
  onToggleNotifications,
}: {
  onUnpair?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Settings</Text>

      <Card title={PRIVACY_HEADLINE} tone="soft">
        <Text style={styles.body}>{PRIVACY_LINE}</Text>
      </Card>

      {onToggleNotifications && (
        <Card title="Partner signals">
          <Text style={styles.body}>
            A quiet nudge when your partner has written their side, and when a reveal is ready.
            Always the same fixed wording — never anything either of you wrote.
          </Text>
          <Button
            label={notificationsEnabled ? 'On — tap to turn off' : 'Off — tap to turn on'}
            variant="secondary"
            onPress={onToggleNotifications}
            style={styles.toggleButton}
          />
        </Card>
      )}

      <Card title="A note on what this is">
        <Text style={styles.body}>{NOT_PRO_ADVICE}</Text>
      </Card>

      {onUnpair && (
        <Card title="Unpair">
          <Text style={styles.body}>
            Removes the keys from this phone and wipes everything the sync service holds for the
            two of you. Past entries stay only on your phones.
          </Text>
          {confirming ? (
            <View style={styles.confirmRow}>
              <Button label="Yes, unpair" onPress={onUnpair} />
              <Button label="Keep us paired" variant="quiet" onPress={() => setConfirming(false)} />
            </View>
          ) : (
            <Button
              label="Unpair…"
              variant="secondary"
              style={styles.unpairButton}
              onPress={() => setConfirming(true)}
            />
          )}
        </Card>
      )}

      <Text style={styles.version}>
        {APP_NAME} {VERSION}
      </Text>
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
  version: {
    color: colors.inkFaint,
    fontSize: font.size.xs,
    marginTop: space.md,
    textAlign: 'center',
  },
  confirmRow: {
    gap: space.sm,
    marginTop: space.md,
  },
  unpairButton: {
    marginTop: space.md,
  },
  toggleButton: {
    alignSelf: 'flex-start',
    marginTop: space.md,
  },
});
