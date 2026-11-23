import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

/**
 * Herramienta para quien tiene membresía activa del gimnasio o la suscripción
 * digital. Al usuario de la app se le ofrece la suscripción; al socio del
 * gimnasio con la membresía vencida, renovar aquí o usar solo la app.
 */
export function Locked({ what }: { what: string }) {
  const router = useRouter();
  const { member } = useAuth();
  const appUser = member?.kind === 'app';

  return (
    <View style={styles.box}>
      <Text style={styles.icon}>🔒</Text>
      {appUser ? (
        <>
          <Text style={styles.title}>Incluido en Iron Fit Online</Text>
          <Text style={styles.text}>
            {what} es parte de Iron Fit Online: el WOD de cada día y todas las herramientas del box. Pruébalo 7 días
            gratis.
          </Text>
          <View style={styles.action}>
            <Button label="Ver planes" onPress={() => router.push('/suscripcion')} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>Exclusivo para socios activos</Text>
          <Text style={styles.text}>
            {what} es parte de tu membresía Iron Fit. Renueva para seguir sumando; tu historial sigue guardado.
          </Text>
          <View style={styles.action}>
            <Button label="Renovar membresía" onPress={() => router.push('/renovar')} />
            <Button label="O usa solo la app" variant="ghost" onPress={() => router.push('/suscripcion')} />
          </View>
        </>
      )}
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
  action: { alignSelf: 'stretch', marginTop: space.sm, gap: space.sm },
});
