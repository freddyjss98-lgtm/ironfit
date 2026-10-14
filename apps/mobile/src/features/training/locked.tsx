import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { colors, fonts, radius, space } from '@/theme';

/** Herramienta exclusiva para socios con membresía activa. */
export function Locked({ what }: { what: string }) {
  const router = useRouter();
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Exclusivo para socios activos</Text>
      <Text style={styles.text}>
        {what} es parte de tu membresía Iron Fit. Renueva para seguir sumando; tu historial sigue guardado.
      </Text>
      <View style={styles.action}>
        <Button label="Renovar membresía" onPress={() => router.push('/renovar')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
  },
  icon: { fontSize: 28 },
  title: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.fg, textAlign: 'center' },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim, textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: space.sm },
});
