import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, MutationCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

// Define la tarea de ubicación en el ámbito global (la necesita el sistema al
// despertar la app mientras se graba una actividad).
import '@/features/gps/recorder';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isNetworkError, OFFLINE_MESSAGE, reportOffline, startNetworkWatch } from '@/lib/offline/network';
import { startOutbox } from '@/lib/offline/outbox';
// Cómo se envía cada registro pendiente de la bandeja de salida.
import '@/lib/offline/senders';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Lo cargado se guarda en el teléfono hasta 7 días: sin internet se ve igual. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: KEEP_MS,
      // Un fallo de red marca "sin conexión": React Query pausa la consulta
      // (con sus datos guardados) y la retoma sola cuando vuelve la señal.
      retry: (count, err) => {
        if (isNetworkError(err)) {
          reportOffline();
          return true;
        }
        return count < 1;
      },
    },
    // Las escrituras se intentan siempre: las que pueden esperar se guardan en
    // la bandeja (outbox.ts) y el resto muestra que necesita internet.
    mutations: { networkMode: 'always' },
  },
  mutationCache: new MutationCache({
    onError: (err) => {
      if (!isNetworkError(err)) return;
      reportOffline();
      if (err instanceof Error) err.message = OFFLINE_MESSAGE;
    },
  }),
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'ironfit:query-cache', throttleTime: 2000 });

startNetworkWatch();
startOutbox(queryClient);

// Al volver a la app, React Query refresca lo que esté viejo (equivale al
// "focus" de la ventana en la web).
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Anton_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceMono_400Regular,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: KEEP_MS, buster: 'v1' }}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator fontsReady={fontsLoaded || !!fontError} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

// Pantallas secundarias (se abren encima de las pestañas): con barra y "atrás".
const pushed = {
  headerShown: true,
  animation: 'default',
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.fg,
  headerTitleStyle: { fontFamily: fonts.cond, fontSize: 18 },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
} as const;

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useAuth();
  const loading = !fontsReady || status === 'loading';

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  // Mientras se restaura la sesión sigue el splash nativo.
  if (loading) return null;

  // Cada estado de la cuenta habilita solo sus pantallas; si el estado cambia
  // (login, logout, contraseña cambiada) el router redirige solo.
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Protected guard={status === 'member'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="renovar" options={{ ...pushed, title: 'Renovar membresía' }} />
        <Stack.Screen name="wod/registrar" options={{ ...pushed, title: 'Mi WOD' }} />
        <Stack.Screen name="wod/compartir" options={{ ...pushed, title: 'Compartir mi WOD' }} />
        <Stack.Screen name="marca" options={{ ...pushed, title: 'Récord' }} />
        <Stack.Screen name="cuerpo/registrar" options={{ ...pushed, title: 'Registrar medición' }} />
        <Stack.Screen name="fuerza/sesion" options={{ ...pushed, title: 'Registrar sesión' }} />
        <Stack.Screen name="fuerza/rutina" options={{ ...pushed, title: 'Nueva rutina' }} />
        <Stack.Screen name="deportes/registrar" options={{ ...pushed, title: 'Registrar actividad' }} />
        <Stack.Screen name="deportes/grabar" options={{ ...pushed, title: 'Grabar actividad' }} />
        <Stack.Screen name="deportes/guardar" options={{ ...pushed, title: 'Guardar actividad' }} />
        <Stack.Screen name="deportes/compartir" options={{ ...pushed, title: 'Compartir actividad' }} />
        <Stack.Screen name="reto/[id]" options={{ ...pushed, title: 'Reto cumplido' }} />
        <Stack.Screen name="tienda" options={{ ...pushed, title: 'Tienda' }} />
        <Stack.Screen name="perfil/index" options={{ ...pushed, title: 'Mi perfil' }} />
        <Stack.Screen name="perfil/editar" options={{ ...pushed, title: 'Editar perfil' }} />
        <Stack.Screen name="perfil/clave" options={{ ...pushed, title: 'Cambiar contraseña' }} />
        <Stack.Screen name="perfil/eliminar" options={{ ...pushed, title: 'Eliminar cuenta' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'mustChangePassword'}>
        <Stack.Screen name="cambiar-clave" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'noMember'}>
        <Stack.Screen name="sin-ficha" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'offline'}>
        <Stack.Screen name="sin-conexion" />
      </Stack.Protected>
    </Stack>
  );
}
