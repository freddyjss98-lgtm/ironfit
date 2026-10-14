import { Screen } from '@/components/screen';
import { Body, Eyebrow, Title } from '@/components/text';
import { useAuth } from '@/lib/auth';

export default function MembershipScreen() {
  const { member } = useAuth();
  const firstName = member?.full_name.trim().split(/\s+/)[0] ?? '';

  return (
    <Screen>
      <Eyebrow>Mi membresía</Eyebrow>
      <Title>Hola, {firstName}</Title>
      <Body dim>Aquí verás tu plan, los días que te quedan y tu asistencia.</Body>
    </Screen>
  );
}
