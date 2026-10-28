import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

type Option<T extends string> = { value: T; label: string };

/** Selector de una opción entre pocas (botones en fila). */
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  columns,
}: {
  label: string;
  options: Option<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** Botones por fila cuando no caben todos (por defecto 4 si hay más de 4). */
  columns?: number;
}) {
  const wrap = columns != null || options.length > 4;
  const basis = `${Math.floor(100 / (columns ?? 4)) - 2}%` as const;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, wrap && styles.wrap]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.option, wrap && styles.optionWrap, wrap && { flexBasis: basis }, selected && styles.selected]}>
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
  wrap: { flexWrap: 'wrap' },
  optionWrap: { flex: 0, flexGrow: 1 },
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
