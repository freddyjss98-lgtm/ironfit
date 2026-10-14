import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

/** Tarjeta base (bg-white/5 + borde, como el portal web). */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Encabezado pequeño de sección dentro o fuera de una tarjeta. */
export function SectionLabel({ children, right }: { children: string; right?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{children}</Text>
      {right ? <Text style={styles.right}>{right}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: {
    fontFamily: fonts.condSemi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.fgDim,
  },
  right: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
});
