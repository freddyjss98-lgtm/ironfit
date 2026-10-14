import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

type Props = TextInputProps & {
  label: string;
  /** Muestra el botón de ver/ocultar contraseña. */
  password?: boolean;
};

export function TextField({ label, password = false, style, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(password);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, focused && styles.boxFocused]}>
        <TextInput
          {...input}
          secureTextEntry={hidden}
          placeholderTextColor={colors.fgMute}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {password && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            style={styles.eye}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.fgDim} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs + 2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
  },
  boxFocused: { borderColor: colors.accent },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.fg,
  },
  eye: { paddingHorizontal: space.md },
});
