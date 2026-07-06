import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../theme';

export function Card({
  title,
  children,
  tone = 'default',
  style,
}: {
  title?: string;
  children?: React.ReactNode;
  tone?: 'default' | 'soft' | 'ready';
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.base, styles[tone], style]}>
      {title != null && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  default: {
    backgroundColor: colors.surface,
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
  },
  ready: {
    backgroundColor: colors.readySoft,
    borderColor: colors.ready,
  },
  title: {
    color: colors.ink,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    marginBottom: space.sm,
  },
});
