// Secciones de la pantalla de inicio. Equivalen a los componentes de
// apps/web/app/portal/page.tsx.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { AttendanceStats } from '@ironfit/shared/portal/stats';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, SectionLabel } from '@/components/card';
import { ProgressRing } from '@/components/progress-ring';
import { fmtShort, fmtWeekdayLong } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

import type { MembershipRow, UpcomingClosure } from './use-home';

const GREEN = '#34d399';
const AMBER = '#fbbf24';
const RED = '#f87171';

// ── Racha ────────────────────────────────────────────────────────────────────
export function StreakBadge({ streak }: { streak: number }) {
  const active = streak > 0;
  return (
    <View
      accessibilityLabel={`Racha de ${streak} días`}
      style={[styles.streak, active ? styles.streakOn : styles.streakOff]}>
      <Text style={styles.streakEmoji}>{active ? '🔥' : '💤'}</Text>
      <View>
        <Text style={[styles.streakNumber, { color: active ? colors.accent : colors.fgMute }]}>{streak}</Text>
        <Text style={[styles.streakLabel, { color: active ? colors.accent : colors.fgMute }]}>racha</Text>
      </View>
    </View>
  );
}

// ── Días que el gym no abre ──────────────────────────────────────────────────
export function ClosureNotice({
  closures,
  today,
  endDate,
}: {
  closures: UpcomingClosure[];
  today: string;
  endDate: string | null;
}) {
  const credited = closures.filter((c) => c.credited).length;
  return (
    <View style={styles.closure}>
      <Text style={styles.closureEmoji}>🗓️</Text>
      <View style={styles.flex}>
        <Text style={styles.closureTitle}>
          {closures.length === 1 ? 'El gimnasio no abrirá' : 'Días que el gimnasio no abrirá'}
        </Text>
        {closures.map((c) => (
          <Text key={c.date} style={styles.closureItem}>
            <Text style={styles.closureDay}>{fmtWeekdayLong(c.date)}</Text>
            {c.date === today ? ' (hoy)' : ''} · {c.reason}
          </Text>
        ))}
        {credited > 0 && endDate ? (
          <Text style={styles.closureNote}>
            No pierdes nada: ya sumamos {credited === 1 ? 'ese día' : `esos ${credited} días`} a tu membresía. Ahora
            vence el {fmtShort(endDate)}.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Meta semanal ─────────────────────────────────────────────────────────────
export function WeeklyGoalCard({ stats }: { stats: AttendanceStats }) {
  const { visitsThisWeek, weeklyGoal, weekStreak } = stats;
  const reached = visitsThisWeek >= weeklyGoal;
  const remaining = Math.max(0, weeklyGoal - visitsThisWeek);

  return (
    <Card style={styles.goal}>
      <ProgressRing value={visitsThisWeek} max={weeklyGoal}>
        <Text style={styles.goalNumber}>{visitsThisWeek}</Text>
        <Text style={styles.goalOf}>de {weeklyGoal}</Text>
      </ProgressRing>
      <View style={styles.flex}>
        <SectionLabel>Meta semanal</SectionLabel>
        <Text style={styles.goalTitle}>{reached ? '¡Meta cumplida! 🎉' : `Faltan ${remaining}`}</Text>
        <Text style={styles.dim}>
          {reached
            ? 'Excelente semana, sigue así.'
            : `${remaining} entreno${remaining !== 1 ? 's' : ''} más para tu objetivo.`}
        </Text>
        {weekStreak > 0 && (
          <Text style={styles.pill}>
            🔥 {weekStreak} semana{weekStreak !== 1 ? 's' : ''} en meta
          </Text>
        )}
      </View>
    </Card>
  );
}

// ── Membresía ────────────────────────────────────────────────────────────────
export function MembershipCard({ membership, onActivate }: { membership: MembershipRow | null; onActivate: () => void }) {
  const plan = membership?.membership_plans ?? null;
  const status = membership?.effective_status ?? 'no_membership';
  const daysLeft = membership?.days_until_expiry ?? 0;
  const isActive = status === 'active';
  const tone = !isActive || daysLeft <= 7 ? RED : daysLeft <= 14 ? AMBER : GREEN;
  const badge = isActive ? 'Activa' : status === 'expired' ? 'Vencida' : status === 'frozen' ? 'Congelada' : 'Sin plan';

  return (
    <View style={[styles.membership, plan?.color ? { backgroundColor: `${plan.color}1f` } : null]}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <SectionLabel>Membresía</SectionLabel>
          <Text style={styles.planName}>{plan?.name ?? 'Sin plan'}</Text>
          {plan?.is_exclusive && (
            <View style={styles.exclusive}>
              <Text style={styles.exclusiveTag}>★ Plan exclusivo</Text>
              <Text style={styles.exclusiveNote}>Reservado solo para ti, gracias por tu fidelidad</Text>
            </View>
          )}
        </View>
        <Text style={[styles.badge, { color: tone, backgroundColor: `${tone}26` }]}>{badge}</Text>
      </View>

      {membership ? (
        <View style={styles.membershipBody}>
          {isActive && (
            <View style={styles.daysRow}>
              <Text style={[styles.daysNumber, { color: tone }]}>{daysLeft}</Text>
              <Text style={styles.dim}>días restantes</Text>
            </View>
          )}
          <Text style={styles.small}>
            {fmtShort(membership.start_date)} → {fmtShort(membership.end_date)}
          </Text>
          {plan && isActive && (
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(0, Math.min(100, (daysLeft / plan.duration_days) * 100))}%`,
                    backgroundColor: plan.color,
                  },
                ]}
              />
            </View>
          )}
        </View>
      ) : (
        <Pressable onPress={onActivate} style={styles.activate} accessibilityRole="button">
          <Text style={styles.activateText}>Activar membresía →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Cifras rápidas ───────────────────────────────────────────────────────────
export function StatTiles({ stats }: { stats: AttendanceStats }) {
  const tiles = [
    { label: 'Racha actual', value: stats.currentStreak, unit: 'días', accent: true },
    { label: 'Mejor racha', value: stats.bestStreak, unit: 'días' },
    { label: 'Este mes', value: stats.visitsThisMonth, unit: 'visitas' },
    { label: 'Total', value: stats.totalVisits, unit: 'visitas' },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <Card key={t.label} style={styles.tile}>
          <SectionLabel>{t.label}</SectionLabel>
          <Text style={[styles.tileValue, t.accent && { color: colors.accent }]}>{t.value}</Text>
          <Text style={styles.small}>{t.unit}</Text>
        </Card>
      ))}
    </View>
  );
}

// ── Logros ───────────────────────────────────────────────────────────────────
export function Achievements({ stats }: { stats: AttendanceStats }) {
  const unlocked = stats.achievements.filter((a) => a.unlocked).length;
  return (
    <Card>
      <SectionLabel right={`${unlocked}/${stats.achievements.length} desbloqueados`}>Logros</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievements}>
        {stats.achievements.map((a) => (
          <View
            key={a.id}
            accessibilityLabel={`${a.title}: ${a.description}${a.unlocked ? ', desbloqueado' : ''}`}
            style={[styles.achievement, a.unlocked ? styles.achievementOn : styles.achievementOff]}>
            <Text style={styles.achievementEmoji}>{a.emoji}</Text>
            <Text style={styles.achievementTitle}>{a.title}</Text>
            <Text style={styles.achievementDesc}>{a.description}</Text>
            {!a.unlocked && a.progress > 0 && (
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${Math.round(a.progress * 100)}%`, backgroundColor: colors.accent }]} />
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

// ── Últimos 30 días ──────────────────────────────────────────────────────────
export function ActivityHeatmap({ stats }: { stats: AttendanceStats }) {
  const visited = stats.last30.filter((d) => d.visited).length;
  const rows = [stats.last30.slice(0, 15), stats.last30.slice(15)];
  return (
    <Card>
      <SectionLabel right={`${visited} días entrenados`}>Últimos 30 días</SectionLabel>
      <View style={styles.heatmap}>
        {rows.map((row, i) => (
          <View key={i} style={styles.heatRow}>
            {row.map((d) => (
              <View key={d.date} style={[styles.heatCell, d.visited ? styles.heatOn : styles.heatOff]} />
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Accesos rápidos ──────────────────────────────────────────────────────────
type IconName = ComponentProps<typeof Ionicons>['name'];

export function QuickAction({
  icon,
  label,
  onPress,
  highlight,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  highlight?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.quick, highlight ? styles.quickHighlight : null, pressed && { opacity: 0.8 }]}>
      <View style={[styles.quickIcon, highlight ? styles.quickIconHighlight : null]}>
        <Ionicons name={icon} size={20} color={highlight ? '#fff' : colors.fgDim} />
      </View>
      <Text style={[styles.quickLabel, highlight ? { color: '#fff' } : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  dim: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },

  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 14,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  streakOn: { backgroundColor: 'rgba(232,75,31,0.15)', borderColor: 'rgba(232,75,31,0.4)' },
  streakOff: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.line },
  streakEmoji: { fontSize: 18 },
  streakNumber: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22 },
  streakLabel: { fontFamily: fonts.condSemi, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.7 },

  closure: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: 'rgba(59,130,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)',
    borderRadius: radius.lg,
    padding: space.lg,
  },
  closureEmoji: { fontSize: 20 },
  closureTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#bfdbfe', marginBottom: space.xs },
  closureItem: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim, lineHeight: 20 },
  closureDay: { fontFamily: fonts.bodyMedium, color: colors.fg },
  closureNote: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: space.sm, lineHeight: 17 },

  goal: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  goalNumber: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.fg },
  goalOf: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  goalTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.fg, textTransform: 'uppercase', marginVertical: 2 },
  pill: {
    alignSelf: 'flex-start',
    marginTop: space.sm,
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.accent,
    backgroundColor: 'rgba(232,75,31,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },

  membership: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: space.lg + 4,
  },
  planName: { fontFamily: fonts.bodySemi, fontSize: 18, color: colors.fg, marginTop: 2 },
  exclusive: { marginTop: space.sm, gap: 2 },
  exclusiveTag: { fontFamily: fonts.cond, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#fde68a' },
  exclusiveNote: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(253,230,138,0.6)' },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  membershipBody: { marginTop: space.lg },
  daysRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  daysNumber: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  bar: { height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 999, overflow: 'hidden', marginTop: space.md },
  barFill: { height: '100%', borderRadius: 999 },
  activate: {
    marginTop: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  activateText: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#fff' },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexBasis: '47%', flexGrow: 1, padding: space.md + 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: colors.fg, marginTop: space.xs },

  achievements: { gap: space.md, paddingTop: space.md },
  achievement: { width: 104, borderRadius: radius.md, borderWidth: 1, padding: space.md, alignItems: 'center' },
  achievementOn: { backgroundColor: 'rgba(232,75,31,0.10)', borderColor: 'rgba(232,75,31,0.3)' },
  achievementOff: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: colors.line, opacity: 0.5 },
  achievementEmoji: { fontSize: 24, marginBottom: space.xs },
  achievementTitle: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.fg, textAlign: 'center' },
  achievementDesc: { fontFamily: fonts.body, fontSize: 10, color: colors.fgMute, textAlign: 'center', marginTop: 2 },

  heatmap: { gap: 5, marginTop: space.md },
  heatRow: { flexDirection: 'row', gap: 5 },
  heatCell: { flex: 1, aspectRatio: 1, borderRadius: 3 },
  heatOn: { backgroundColor: colors.accent },
  heatOff: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(36,36,36,0.6)' },

  quick: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quickHighlight: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  quickIconHighlight: { backgroundColor: 'rgba(255,255,255,0.15)' },
  quickLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
});
