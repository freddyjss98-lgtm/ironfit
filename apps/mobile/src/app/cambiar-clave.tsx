import { useState } from 'react';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Eyebrow, Title } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authErrorMessage, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// El admin creó el acceso con una contraseña temporal (must_change_password);
// igual que en /portal/cambiar-clave, no se entra hasta elegir una propia.
export default function ChangePasswordScreen() {
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    // Al actualizarse el usuario, la sesión trae el flag en false y el layout
    // raíz pasa solo al panel.
    if (updateError) {
      setError(authErrorMessage(updateError.message));
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <Eyebrow>Primer ingreso</Eyebrow>
      <Title>Crea tu contraseña</Title>
      <Body dim>
        El gimnasio creó tu acceso con una contraseña temporal. Elige una nueva para continuar.
      </Body>

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
        label="Repite la contraseña"
        value={confirm}
        onChangeText={setConfirm}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label="Guardar y entrar" onPress={submit} loading={loading} />
      <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}
