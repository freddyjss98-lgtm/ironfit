import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

/** Sub-pestañas dentro de una pantalla. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.item, on && styles.itemOn]}>
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: 3,
    gap: 3,
  },
  item: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.sm },
  itemOn: { backgroundColor: colors.accent },
  text: { fontFamily: fonts.condSemi, fontSize: 14, letterSpacing: 0.5, color: colors.fgDim },
  textOn: { color: '#fff' },
});
