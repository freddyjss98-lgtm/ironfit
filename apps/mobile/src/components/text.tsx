import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = { children: ReactNode; style?: TextStyle; center?: boolean };

/** Titular de pantalla (Anton, mayúsculas), como los h1 del portal web. */
export function Title({ children, style, center }: Props) {
  return <Text style={[styles.title, center && styles.center, style]}>{children}</Text>;
}

/** Texto corrido. */
export function Body({ children, style, center, dim }: Props & { dim?: boolean }) {
  return <Text style={[styles.body, dim && styles.dim, center && styles.center, style]}>{children}</Text>;
}

/** Etiqueta corta en mayúsculas (Barlow Condensed). */
export function Eyebrow({ children, style, center }: Props) {
  return <Text style={[styles.eyebrow, center && styles.center, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.fg,
    textTransform: 'uppercase',
  },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.fg },
  dim: { color: colors.fgDim },
  eyebrow: {
    fontFamily: fonts.cond,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  center: { textAlign: 'center' },
});
