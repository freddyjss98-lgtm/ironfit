import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { TextField } from '@/components/text-field';
import { authErrorMessage } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    // Si entra, el layout raíz cambia de pantalla solo (Stack.Protected).
    if (signInError) {
      setError(authErrorMessage(signInError.message));
      setLoading(false);
    }
  }

  return (
    <Screen centered>
      <View style={styles.header}>
        <Logo />
        <Body dim center>
          Tu área de atleta
        </Body>
      </View>

      <Title>Iniciar sesión</Title>

      {error && <Notice message={error} />}

      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        placeholder="tu@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        password
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label="Entrar" onPress={submit} loading={loading} />

      <Text style={styles.footer}>
        ¿No tienes cuenta?{' '}
        <Link href="/register" style={styles.link}>
          Regístrate
        </Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, marginBottom: space.lg },
  footer: { fontFamily: fonts.body, fontSize: 14, color: colors.fgMute, textAlign: 'center' },
  link: { color: colors.fg, textDecorationLine: 'underline' },
});
