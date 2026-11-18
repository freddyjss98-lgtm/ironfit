import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { useAuth } from '@/lib/auth';

// Hay sesión guardada pero no se pudo leer la ficha del socio y no hay nada
// guardado en el teléfono (sin internet la primera vez, o el servidor no
// responde). Con datos guardados la app entra igual y muestra la franja.
export default function OfflineScreen() {
  const { retry, signOut } = useAuth();

  return (
    <Screen centered banner={false}>
      <Title center>Sin conexión</Title>
      <Body dim center>
        Para usar la app sin internet tiene que haberse abierto antes con conexión. Revisa tu internet e inténtalo de
        nuevo.
      </Body>
      <Button label="Reintentar" onPress={retry} />
      <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut()} />
    </Screen>
  );
}
