import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/theme';

/** Aviso de error o de éxito dentro de un formulario. */
export function Notice({ message, tone = 'error' }: { message: string; tone?: 'error' | 'ok' }) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, tone === 'error' ? styles.error : styles.ok]}>
      <Text style={[styles.text, { color: tone === 'error' ? colors.danger : colors.ok }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.sm + 2, paddingHorizontal: space.lg, paddingVertical: space.md },
  error: { backgroundColor: colors.dangerBg, borderColor: 'rgba(239,68,68,0.3)' },
  ok: { backgroundColor: colors.okBg, borderColor: 'rgba(16,185,129,0.3)' },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});
