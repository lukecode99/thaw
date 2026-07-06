import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../theme';

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'none',
  style,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      {label != null && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.inkSoft,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    marginBottom: space.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: font.size.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
