import { isValidCedula, normalizeCedula } from '@ironfit/shared/cedula';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { DateField } from '@/components/date-field';
import { Logo } from '@/components/logo';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { TextField } from '@/components/text-field';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/theme';

type Gender = 'M' | 'F' | 'other';

type RegisterResult = {
  needsConfirmation: boolean;
  session: { access_token: string; refresh_token: string } | null;
};

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  async function submit() {
    // Mismas validaciones que el servidor, para avisar antes de enviar.
    if (!fullName.trim() || !cedula || !phone.trim() || !birthday || !gender || !email.trim() || !password) {
      setError('Completa todos los campos.');
      return;
    }
    if (!isValidCedula(normalizeCedula(cedula))) {
      setError('La cédula ingresada no es válida.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api<RegisterResult>('/api/app/register', {
        method: 'POST',
        auth: false,
        body: { fullName, cedula, phone, birthday, gender, email: email.trim(), password },
      });
      if (result.session) {
        // Con sesión el layout raíz pasa solo al panel del socio.
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
          Crea tu cuenta de atleta
        </Body>
      </View>

      <Title>Registrarse</Title>

      {error && <Notice message={error} />}

      <TextField
        label="Nombre completo"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Ej. Carlos Rodríguez"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label="Cédula"
        value={cedula}
        onChangeText={(t) => setCedula(t.replace(/\D/g, '').slice(0, 10))}
        placeholder="10 dígitos"
        keyboardType="number-pad"
        maxLength={10}
      />
      <TextField
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholder="0999 123 456"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <DateField label="Fecha de nacimiento" value={birthday} onChange={setBirthday} maximumDate={new Date()} />
      <Choice<Gender>
        label="Género"
        value={gender}
        onChange={setGender}
        options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Femenino' },
          { value: 'other', label: 'Otro' },
        ]}
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
