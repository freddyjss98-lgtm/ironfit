// Reglas de la comunidad: el socio las acepta una vez antes de entrar (Apple
// lo exige para apps con contenido de usuarios, guía 1.2).

import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { colors, fonts, space } from '@/theme';

import { useAcceptTerms } from './use-community';

const RULES = [
  'Publica fotos tuyas entrenando o cumpliendo retos.',
  'Nada de desnudos, violencia, insultos, burlas ni publicidad.',
  'Lo que publiques lo ven todos los socios activos de Iron Fit.',
  'Puedes reportar o bloquear a quien no cumpla las reglas. El equipo revisa los reportes en menos de 24 horas y puede quitar publicaciones o el acceso a la comunidad.',
];

export function CommunityTerms({ memberId }: { memberId: string }) {
  const accept = useAcceptTerms(memberId);
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>Bienvenido a la comunidad Iron Fit</Text>
      <Text style={styles.text}>Aquí se comparten los retos cumplidos y los entrenamientos de los socios. Antes de entrar:</Text>
      <View style={styles.list}>
        {RULES.map((r) => (
          <View key={r} style={styles.item}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.text, styles.flex]}>{r}</Text>
          </View>
        ))}
      </View>
      <Button
        label="Acepto las reglas"
        loading={accept.isPending}
        onPress={() => accept.mutate(undefined, { onError: (e) => Alert.alert('No se pudo guardar', e.message) })}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  flex: { flex: 1 },
  title: { fontFamily: fonts.bodySemi, fontSize: 17, color: colors.fg },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  list: { gap: space.sm },
  item: { flexDirection: 'row', gap: space.sm },
  bullet: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20, color: colors.accent },
});
