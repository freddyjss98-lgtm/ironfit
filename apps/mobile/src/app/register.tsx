import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { TextField } from '@/components/text-field';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

type RegisterResult = {
  needsConfirmation: boolean;
  session: { access_token: string; refresh_token: string } | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registro abierto (v1.1): cualquiera crea su cuenta para usar la app con
// Iron Fit Online. Solo lo necesario; los socios del gimnasio ya tienen cuenta
// (la crea recepción) y entran desde "Iniciar sesión".
export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    // Mismas validaciones que el servidor, para avisar antes de enviar.
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Completa tu nombre, correo y contraseña.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('El correo no es válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api<RegisterResult>('/api/app/signup', {
        method: 'POST',
        auth: false,
        body: { fullName, email: email.trim(), password },
      });
      if (result.session) {
        // Con sesión el layout raíz pasa solo al panel.
        await supabase.auth.setSession(result.session);
      } else {
        setConfirmSent(true);
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta.');
      setLoading(false);
    }
  }

  if (confirmSent) {
    return (
      <Screen centered>
        <Logo />
        <Notice tone="ok" message={`Te enviamos un correo a ${email.trim()}. Confírmalo y luego inicia sesión.`} />
        <Link href="/login" style={styles.back}>
          Volver a iniciar sesión
        </Link>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Logo />
        <Body dim center>
          Entrena con la programación de Iron Fit
        </Body>
      </View>

      <Title>Crear cuenta</Title>
      <Body dim>¿Ya eres socio del gimnasio? No necesitas registrarte: entra con el correo que diste en recepción.</Body>

      {error && <Notice message={error} />}

      <TextField
        label="Nombre"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ej. Carlos Rodríguez"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={80}
      />
      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        placeholder="Mínimo 6 caracteres"
        password
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Button label="Crear cuenta" onPress={submit} loading={loading} />

      <Text style={styles.footer}>
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" style={styles.link}>
          Inicia sesión
        </Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, marginBottom: space.sm },
  footer: { fontFamily: fonts.body, fontSize: 14, color: colors.fgMute, textAlign: 'center' },
  link: { color: colors.fg, textDecorationLine: 'underline' },
  back: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim, textAlign: 'center' },
});
