import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Body, Eyebrow, Title } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { space } from '@/theme';

export default function ProfileScreen() {
  const { member, session, signOut } = useAuth();

  return (
    <Screen>
      <Eyebrow>Perfil</Eyebrow>
      <Title>{member?.full_name ?? ''}</Title>
      <Body dim>{session?.user.email ?? ''}</Body>
      <View style={styles.actions}>
        <Button label="Cerrar sesión" variant="secondary" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { marginTop: space.xl } });
