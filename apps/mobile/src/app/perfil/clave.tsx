import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { changePassword } from '@/features/profile/use-profile';
import { authErrorMessage } from '@/lib/auth';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await changePassword(password);
      Alert.alert('Listo', 'Tu contraseña se actualizó.');
      router.back();
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.'));
      setLoading(false);
    }
  }

  return (
    <Screen>
      {error && <Notice message={error} />}
      <TextField
        label="Nueva contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres"
        password
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirmar contraseña"
        value={confirm}
        onChangeText={setConfirm}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <Button label="Guardar" onPress={submit} loading={loading} />
    </Screen>
  );
}
