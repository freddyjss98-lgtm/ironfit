import { Linking } from 'react-native';

import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { WEB_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';

// La app es solo para socios. Una cuenta de staff sin ficha de atleta usa el
// panel web (quien es staff y además entrena sí tiene ficha y entra normal).
export default function NoMemberScreen() {
  const { signOut } = useAuth();

  return (
    <Screen centered>
      <Logo />
      <Title center>Esta app es para socios</Title>
      <Body dim center>
        Tu cuenta no tiene ficha de atleta. El panel del gimnasio está en la web, en ironfitclub.org.
      </Body>
      <Button label="Abrir el panel web" onPress={() => Linking.openURL(`${WEB_URL}/admin`)} />
      <Button label="Cerrar sesión" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
