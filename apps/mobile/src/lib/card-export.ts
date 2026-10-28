// Exportar una tarjeta sin fondo (WOD o actividad): PNG transparente de 1080
// px de ancho para guardar en fotos, copiar o compartir.

import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useState, type RefObject } from 'react';
import { Alert, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

export type ExportKind = 'save' | 'copy' | 'share';

export function useCardExport(cardRef: RefObject<View | null>, dialogTitle: string) {
  const [busy, setBusy] = useState<null | ExportKind>(null);

  const capture = (as: 'tmpfile' | 'base64') => captureRef(cardRef, { format: 'png', result: as, width: 1080 });

  async function run(kind: ExportKind, fn: () => Promise<void>) {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('No se pudo', e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run('save', async () => {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) throw new Error('Permite guardar en tus fotos desde los ajustes del teléfono.');
      await MediaLibrary.Asset.create(await capture('tmpfile'));
      Alert.alert('Guardada en tus fotos', 'En tu historia de Instagram, toca el sticker de Foto y elige la imagen.');
    });

  const copy = () =>
    run('copy', async () => {
      await Clipboard.setImageAsync(await capture('base64'));
      Alert.alert('Copiada', 'Abre tu historia de Instagram, toma o elige tu foto y pega la tarjeta encima.');
    });

  const share = () =>
    run('share', async () => {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Compartir no está disponible en este teléfono.');
      await Sharing.shareAsync(await capture('tmpfile'), { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
    });

  return { busy, save, copy, share };
}
