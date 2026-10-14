import { Anton_400Regular } from '@expo-google-fonts/anton';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator fontsReady={fontsLoaded || !!fontError} />
      </AuthProvider>
    </QueryClientProvider>
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
        <Stack.Screen name="wod/registrar" options={{ ...pushed, title: 'Mi resultado' }} />
        <Stack.Screen name="tienda" options={{ ...pushed, title: 'Tienda' }} />
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
