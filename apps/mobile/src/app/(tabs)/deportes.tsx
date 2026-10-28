import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Title } from '@/components/text';
import { SportsTab } from '@/features/sports/sports-tab';
import { useActiveMembership } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';

// Deportes fuera del box: grabar con GPS, registrar a mano, totales e historial.
export default function SportsScreen() {
  const { member } = useAuth();
  const memberId = member!.id;
  const active = useActiveMembership(memberId);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (q) => ['activities', 'active'].includes(String(q.queryKey[0])),
    });
    setRefreshing(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Title>Deportes</Title>
      <SportsTab memberId={memberId} active={active.data !== false} />
    </Screen>
  );
}
