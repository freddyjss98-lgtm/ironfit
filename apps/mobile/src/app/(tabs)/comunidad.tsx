import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { SectionLabel } from '@/components/card';
import { Screen } from '@/components/screen';
import { Title } from '@/components/text';
import { ChallengeCard } from '@/features/community/challenge-card';
import { PostCard } from '@/features/community/post-card';
import { CommunityTerms } from '@/features/community/terms';
import { RecordingBanner } from '@/features/gps/recording-banner';
import { useChallenges, useCommunityTerms, useFeed } from '@/features/community/use-community';
import { Locked } from '@/features/training/locked';
import { useActiveMembership } from '@/features/training/use-active';
import { useAuth } from '@/lib/auth';
import { colors, fonts, space } from '@/theme';

export default function CommunityScreen() {
  const { member } = useAuth();
  const memberId = member!.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const active = useActiveMembership(memberId);
  const terms = useCommunityTerms(memberId);
  const ready = active.data === true && terms.data === true;
  const challenges = useChallenges(ready);
  const feed = useFeed(ready);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (q) => ['active', 'community-terms', 'challenges', 'feed'].includes(String(q.queryKey[0])),
    });
    setRefreshing(false);
  }

  const posts = feed.data?.pages.flat() ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Title>Comunidad</Title>

      {active.isPending || terms.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : active.data === false ? (
        <Locked what="La comunidad y los retos del gimnasio" />
      ) : !terms.data ? (
        <CommunityTerms memberId={memberId} />
      ) : (
        <>
          <RecordingBanner />
          <SectionLabel>Retos</SectionLabel>
          {challenges.isPending ? (
            <ActivityIndicator color={colors.accent} />
          ) : (challenges.data ?? []).length === 0 ? (
            <Text style={styles.empty}>Por ahora no hay retos. Cuando el gimnasio publique uno te llegará un aviso.</Text>
          ) : (
            challenges.data!.map((c) => <ChallengeCard key={c.id} challenge={c} />)
          )}
          <View style={styles.actions}>
            <Button label="Grabar con GPS" variant="secondary" onPress={() => router.push('/deportes/grabar')} />
            <Button label="Registrar a mano" variant="ghost" onPress={() => router.push('/deportes/registrar')} />
          </View>

          <SectionLabel>Lo último del box</SectionLabel>
          {feed.isPending ? (
            <ActivityIndicator color={colors.accent} />
          ) : feed.isError ? (
            <Text style={styles.empty}>No se pudo cargar la comunidad. Desliza hacia abajo para reintentar.</Text>
          ) : posts.length === 0 ? (
            <Text style={styles.empty}>Todavía no hay publicaciones. ¡Cumple un reto y sé el primero!</Text>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} memberId={memberId} />)
          )}
          {feed.hasNextPage && (
            <Button
              label="Ver más"
              variant="ghost"
              loading={feed.isFetchingNextPage}
              onPress={() => feed.fetchNextPage()}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  actions: { gap: space.xs },
});
