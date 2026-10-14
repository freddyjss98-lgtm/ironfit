// Notificaciones push (Expo). El token se registra en el backend
// (POST /api/app/push-token), que lo guarda en push_tokens; el servidor avisa
// de renovaciones aprobadas/rechazadas y de membresías por vencer.
//
// Necesita un build de desarrollo o de tienda vinculado a un proyecto EAS
// (extra.eas.projectId). En Expo Go o sin projectId no hace nada: el resto de
// la app funciona igual.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

let currentToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushResult = 'enabled' | 'denied' | 'unavailable';

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Registra el teléfono para recibir avisos.
 * @param ask true para pedir el permiso si aún no se dio (botón en Perfil);
 *            false solo registra si el permiso ya está concedido (al abrir la app).
 */
export async function registerForPush(ask: boolean): Promise<PushResult> {
  try {
    if (!Device.isDevice || !projectId()) return 'unavailable';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avisos del gimnasio',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#e84b1f',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    await api('/api/app/push-token', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    currentToken = token;
    return 'enabled';
  } catch (err) {
    console.warn('[push] no se pudo registrar', err);
    return 'unavailable';
  }
}

/** Al cerrar sesión: este teléfono deja de recibir avisos de esa cuenta. */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await api('/api/app/push-token', { method: 'DELETE', body: { token: currentToken } });
  } catch {
    // Si falla, el servidor lo limpia cuando Expo responda DeviceNotRegistered.
  }
  currentToken = null;
}

export async function pushPermissionGranted(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).status === 'granted';
  } catch {
    return false;
  }
}
