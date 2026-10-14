import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

type Option<T extends string> = { value: T; label: string };

/** Selector de una opción entre pocas (botones en fila). */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T | '';
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.selected]}>
              <Text style={[styles.optionText, selected && styles.selectedText]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs + 2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
  row: { flexDirection: 'row', gap: space.sm },
  option: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  selected: { borderColor: colors.accent, backgroundColor: 'rgba(232,75,31,0.15)' },
  optionText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fgDim },
  selectedText: { color: colors.fg },
});
