import React from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { colors, font, radius, space } from '../theme';

// A single reflective prompt with a multiline answer box — the core building
// block of a repair form. Answers stay on this phone until reveal.
export function PromptField({
  prompt,
  value,
  onChangeText,
  placeholder = 'Take your time…',
  style,
}: {
  prompt: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Text style={styles.prompt}>{prompt}</Text>
      <TextInput
        style={styles.answer}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  prompt: {
    color: colors.ink,
    fontSize: font.size.md,
    fontWeight: font.weight.medium,
    lineHeight: font.size.md * 1.4,
  },
  answer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.4,
    minHeight: 120,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
});
