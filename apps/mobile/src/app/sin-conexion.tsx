import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { useAuth } from '@/lib/auth';

// Hay sesión guardada pero no se pudo leer la ficha del socio (sin internet o
// el servidor no responde).
export default function OfflineScreen() {
  const { retry, signOut } = useAuth();

  return (
    <Screen centered>
      <Title center>Sin conexión</Title>
      <Body dim center>
        No pudimos cargar tu cuenta. Revisa tu internet e inténtalo de nuevo.
      </Body>
      <Button label="Reintentar" onPress={retry} />
      <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}
