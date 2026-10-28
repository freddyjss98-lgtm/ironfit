import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import {
  Achievements,
  ActivityHeatmap,
  ClosureNotice,
  MembershipCard,
  QuickAction,
  StatTiles,
  StreakBadge,
  WeeklyGoalCard,
} from '@/features/home/sections';
import { CheckInCard } from '@/features/home/check-in';
import { useHome } from '@/features/home/use-home';
import { useAuth } from '@/lib/auth';
import { greeting, isBirthdayToday } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { member } = useAuth();
  const home = useHome(member!.id);
  const firstName = member!.full_name.trim().split(/\s+/)[0];

  const activate = () => router.push('/renovar');
  const m = home.data?.membership;
  const needsRenewal = !m || m.effective_status !== 'active' || m.days_until_expiry <= 14;

  return (
    <Screen onRefresh={() => home.refetch()} refreshing={home.isRefetching}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Body dim>{greeting()},</Body>
          <Title>{firstName}</Title>
        </View>
        {home.data && <StreakBadge streak={home.data.stats.currentStreak} />}
        <Pressable
          onPress={() => router.push('/perfil')}
          accessibilityRole="button"
          accessibilityLabel="Mi perfil"
          hitSlop={8}
          style={({ pressed }) => [styles.avatar, pressed && { opacity: 0.7 }]}>
          <Avatar name={member!.full_name} url={member!.photo_url} size={44} />
        </Pressable>
      </View>

      {home.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : home.isError ? (
        <View style={styles.gap}>
          <Notice message="No pudimos cargar tu información. Revisa tu conexión." />
          <Button label="Reintentar" variant="secondary" onPress={() => home.refetch()} />
        </View>
      ) : (
        <>
          {m?.effective_status === 'active' && (
            <CheckInCard
              memberId={member!.id}
              checkedInToday={home.data.stats.lastVisit === home.data.today}
            />
          )}
          {home.data.closures.length > 0 && (
            <ClosureNotice
              closures={home.data.closures}
              today={home.data.today}
              endDate={home.data.membership?.end_date ?? null}
            />
          )}
          <WeeklyGoalCard stats={home.data.stats} />
          <MembershipCard membership={home.data.membership} onActivate={activate} />
          <StatTiles stats={home.data.stats} />
          <Achievements stats={home.data.stats} />
          <ActivityHeatmap stats={home.data.stats} />

          <Text style={styles.sectionTitle}>Accesos rápidos</Text>
          <View style={styles.quickGrid}>
            {needsRenewal && <QuickAction icon="refresh" label="Renovar" onPress={activate} highlight />}
            <QuickAction icon="barbell-outline" label="Entrenamiento" onPress={() => router.navigate('/clases')} />
            <QuickAction icon="stats-chart-outline" label="Progreso" onPress={() => router.navigate('/progreso')} />
            <QuickAction icon="receipt-outline" label="Pagos y renovación" onPress={activate} />
            <QuickAction icon="bag-handle-outline" label="Tienda" onPress={() => router.push('/tienda')} />
          </View>

          {member!.birthday && isBirthdayToday(member!.birthday, home.data.today) && (
            <View style={styles.birthday}>
              <Text style={styles.birthdayTitle}>¡Feliz cumpleaños, {firstName}! 🎂</Text>
              <Text style={styles.birthdayText}>El equipo Iron Fit te desea un excelente día.</Text>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  avatar: { borderRadius: 24, borderWidth: 2, borderColor: colors.line2 },
  loading: { marginTop: space.xxl },
  sectionTitle: {
    fontFamily: fonts.condSemi,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.fgMute,
    marginTop: space.sm,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  birthday: {
    backgroundColor: 'rgba(232,75,31,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(232,75,31,0.3)',
    borderRadius: radius.md,
    padding: space.lg,
    alignItems: 'center',
  },
  birthdayTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.accent },
  birthdayText: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim, marginTop: space.xs },
});
