// Fotos de la comunidad: se eligen (cámara o galería), se reducen en el
// teléfono a 1080 px y JPEG ~70 % (unos 200 KB) y se suben al bucket privado
// `community`, en la carpeta del usuario (lo exige el RLS de storage).

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

export const COMMUNITY_BUCKET = 'community';
const MAX_SIDE = 1080;

export type PickedPhoto = { uri: string };

async function pick(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Permiso necesario', 'Permite el acceso en los ajustes del teléfono para subir tu foto.');
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled) return null;

  const a = result.assets[0];
  const ctx = ImageManipulator.manipulate(a.uri);
  if (a.width > MAX_SIDE || a.height > MAX_SIDE) {
    ctx.resize(a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: saved.uri };
}

/** Pregunta cámara o galería y devuelve la foto ya reducida. */
export function choosePhoto(onPicked: (p: PickedPhoto) => void) {
  const run = (source: 'camera' | 'library') =>
    pick(source)
      .then((p) => p && onPicked(p))
      .catch(() => Alert.alert('No se pudo cargar la foto', 'Inténtalo con otra imagen.'));
  Alert.alert('Foto', undefined, [
    { text: 'Tomar foto', onPress: () => run('camera') },
    { text: 'Elegir de la galería', onPress: () => run('library') },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}

export async function uploadCommunityPhoto(userId: string, photo: PickedPhoto): Promise<string> {
  const body = await (await fetch(photo.uri)).arrayBuffer();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(COMMUNITY_BUCKET).upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
  return path;
}

/** Best-effort: si falla queda un archivo huérfano, no un error para el socio. */
export async function removeCommunityPhoto(path: string | null | undefined) {
  if (path) await supabase.storage.from(COMMUNITY_BUCKET).remove([path]).catch(() => {});
}
