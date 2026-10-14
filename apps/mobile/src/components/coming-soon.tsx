import { Screen } from '@/components/screen';
import { Body, Eyebrow, Title } from '@/components/text';

/** Pestaña aún sin contenido (se completa en la fase de pantallas del socio). */
export function ComingSoon({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <Screen>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>{title}</Title>
      <Body dim>Muy pronto.</Body>
    </Screen>
  );
}
