import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Screen } from '@/components/screen';
import { Segmented } from '@/components/segmented';
import { Title } from '@/components/text';
import { BodyTab } from '@/features/body/body-tab';
import { RecordsTab } from '@/features/records/records-tab';
import { StrengthTab } from '@/features/strength/strength-tab';
import { useActiveMembership } from '@/features/training/use-active';
import { WodHistoryTab } from '@/features/wod/history-tab';
import { useAuth } from '@/lib/auth';

type Tab = 'records' | 'wods' | 'body' | 'strength';

export default function ProgressScreen() {
  const { member, session } = useAuth();
  const memberId = member!.id;
  const active = useActiveMembership(memberId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('records');
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (q) => ['lifts', 'wod-history', 'body', 'strength', 'active'].includes(String(q.queryKey[0])),
    });
    setRefreshing(false);
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Title>Progreso</Title>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'records', label: 'Récords' },
          { value: 'wods', label: 'WODs' },
          { value: 'body', label: 'Cuerpo' },
          { value: 'strength', label: 'Fuerza' },
        ]}
      />
      {tab === 'records' && <RecordsTab memberId={memberId} />}
      {tab === 'wods' && <WodHistoryTab memberId={memberId} />}
      {tab === 'body' && <BodyTab memberId={memberId} userId={session!.user.id} active={active.data !== false} />}
      {tab === 'strength' && <StrengthTab memberId={memberId} active={active.data !== false} />}    </Screen>
  );
}
