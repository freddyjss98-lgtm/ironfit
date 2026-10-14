import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { TextField } from '@/components/text-field';
import { deleteAccount } from '@/features/profile/use-profile';
import { useAuth } from '@/lib/auth';
import { colors, fonts, radius, space } from '@/theme';

const CONFIRM_WORD = 'ELIMINAR';

// Lo exigen Apple (5.1.1(v)) y Google Play: el socio puede borrar su cuenta
// desde la app. Ver apps/web/lib/services/account.ts para qué se borra.
export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await deleteAccount();
      await signOut({ accountDeleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la cuenta.');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>Eliminar mi cuenta</Title>
      <Body dim>Esto no se puede deshacer.</Body>

      <View style={styles.box}>
        <Text style={styles.item}>• Se borra tu acceso a la app y al portal web.</Text>
        <Text style={styles.item}>• Se borran tus datos personales, tus medidas, fotos y tu registro de entrenamiento.</Text>
        <Text style={styles.item}>
          • Tus pagos y membresías quedan en la contabilidad del gimnasio, sin tu nombre ni tus datos.
        </Text>
        <Text style={styles.item}>• Si tienes una membresía activa, consulta en recepción antes de eliminar tu cuenta.</Text>
      </View>

      {error && <Notice message={error} />}

      <TextField
        label={`Escribe ${CONFIRM_WORD} para confirmar`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Button
        label="Eliminar definitivamente"
        onPress={submit}
        loading={loading}
        disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  item: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fg },
});
