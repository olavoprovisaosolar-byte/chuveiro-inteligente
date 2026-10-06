import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { FieldLabel } from './InfoTip';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
  tip?: string;
};

export function InputField({ label, hint, error, tip, style, ...rest }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <FieldLabel label={label} tip={tip} />
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: error ? colors.danger : colors.border,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {hint && !error ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 6,
  },
  error: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 12,
    marginTop: 6,
  },
});
