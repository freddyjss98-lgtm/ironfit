import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Choice } from '@/components/choice';
import { DateField } from '@/components/date-field';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useProfile, useSaveProfile, type Profile, type ProfileForm } from '@/features/profile/use-profile';
import { useAuth } from '@/lib/auth';
import { colors, fonts, space } from '@/theme';

type Photo = { uri: string; mimeType?: string };

export default function EditProfileScreen() {
  const { member, session } = useAuth();
  const profile = useProfile(member!.id);

  if (!profile.data) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  return <EditForm current={profile.data.profile} memberId={member!.id} userId={session!.user.id} />;
}

function EditForm({ current, memberId, userId }: { current: Profile; memberId: string; userId: string }) {
  const router = useRouter();
  const save = useSaveProfile(memberId, userId);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    full_name: current.full_name ?? '',
    phone: current.phone ?? '',
    email: current.email ?? '',
    birthday: current.birthday ?? '',
    gender: current.gender ?? '',
    height_cm: current.height_cm != null ? String(current.height_cm) : '',
    goal: current.goal ?? '',
    emergency_contact_name: current.emergency_contact_name ?? '',
  });
  const set = (k: keyof ProfileForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function pick(source: 'camera' | 'library') {
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    };
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso en los ajustes del teléfono para cambiar tu foto.');
      return;
    }
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, mimeType: a.mimeType ?? undefined });
    }
  }

  function choosePhoto() {
    Alert.alert('Foto de perfil', undefined, [
      { text: 'Tomar foto', onPress: () => pick('camera') },
      { text: 'Elegir de la galería', onPress: () => pick('library') },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function submit() {
    save.mutate({ form, current, photo }, { onSuccess: () => router.back() });
  }

  return (
    <Screen>
      <View style={styles.photoRow}>
        <Avatar name={form.full_name} url={photo?.uri ?? current.photo_url} size={88} />
        <Pressable onPress={choosePhoto} accessibilityRole="button" style={styles.photoBtn}>
          <Text style={styles.photoBtnText}>📷 Cambiar foto</Text>
        </Pressable>
      </View>

      {save.error && <Notice message={save.error.message} />}

      <TextField label="Nombre completo" value={form.full_name} onChangeText={set('full_name')} autoCapitalize="words" />
      <TextField label="Teléfono" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <TextField
        label="Correo"
        value={form.email}
        onChangeText={set('email')}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <DateField label="Cumpleaños" value={form.birthday} onChange={set('birthday')} maximumDate={new Date()} />
      <Choice
        label="Género"
        value={form.gender as 'M' | 'F' | 'other' | ''}
        onChange={set('gender')}
        options={[
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Femenino' },
          { value: 'other', label: 'Otro' },
        ]}
      />
      <TextField label="Estatura (cm)" value={form.height_cm} onChangeText={set('height_cm')} keyboardType="decimal-pad" />
      <TextField label="Objetivo" value={form.goal} onChangeText={set('goal')} placeholder="Ej. bajar de peso" />
      <TextField
        label="Contacto de emergencia"
        value={form.emergency_contact_name}
        onChangeText={set('emergency_contact_name')}
        placeholder="Nombre y teléfono de un familiar"
      />

      <Button label="Guardar cambios" onPress={submit} loading={save.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { alignItems: 'center', gap: space.md },
  photoBtn: { paddingVertical: space.sm, paddingHorizontal: space.lg },
  photoBtnText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
});
