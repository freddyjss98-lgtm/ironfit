import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { ClassCard, DAY_FULL, DAY_SHORT, DateStrip, DayWod, dayNum, fmt12h } from '@/features/classes/parts';
import { dowOf, useClasses, type MyBooking } from '@/features/classes/use-classes';
import { useAuth } from '@/lib/auth';
import { ecuadorHour } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/theme';

export default function ClassesScreen() {
  const { member } = useAuth();
  const memberId = member!.id;
  const router = useRouter();
  const classes = useClasses(memberId);
  const [selected, setSelected] = useState<string | null>(null);

  if (classes.isPending || classes.isError) {
    return (
      <Screen>
        <Title>Entrenamiento</Title>
        {classes.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : (
          <View style={styles.gap}>
            <Notice message="No pudimos cargar las clases. Revisa tu conexión." />
            <Button label="Reintentar" variant="secondary" onPress={() => classes.refetch()} />
          </View>
        )}
      </Screen>
    );
  }

  const data = classes.data;
  const date = selected && data.dates.includes(selected) ? selected : data.today;
  const dow = dowOf(date);
  const closedReason = data.closedDays[date];
  const daySchedules = data.schedules.filter((s) => s.day_of_week === dow);
  const nowHour = ecuadorHour();

  const myBookingMap: Record<string, MyBooking> = {};
  for (const b of data.myBookings) myBookingMap[`${b.schedule_id}|${b.booking_date}|${b.start_time}`] = b;
  const upcoming = data.myBookings
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => `${a.booking_date}${a.start_time}`.localeCompare(`${b.booking_date}${b.start_time}`));
  const { d, mon } = dayNum(date);

  return (
    <Screen onRefresh={() => classes.refetch()} refreshing={classes.isRefetching}>
      <View>
        <Title>Entrenamiento</Title>
        <Body dim>
          {upcoming.length > 0
            ? `Tienes ${upcoming.length} reserva${upcoming.length !== 1 ? 's' : ''} próxima${upcoming.length !== 1 ? 's' : ''}`
            : 'Selecciona un día y reserva tu clase'}
        </Body>
      </View>

      {!data.hasActiveMembership && (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>⚠️ Tu membresía no está activa</Text>
          <Text style={styles.warnText}>Necesitas una membresía vigente para reservar clases.</Text>
          <View style={styles.warnAction}>
            <Button label="Renovar membresía" onPress={() => router.push('/renovar')} />
          </View>
        </View>
      )}

      <DateStrip
        dates={data.dates}
        today={data.today}
        selected={date}
        onSelect={setSelected}
        schedules={data.schedules}
        myBookings={data.myBookings}
        closedDays={data.closedDays}
      />

      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderText}>
          {DAY_FULL[dow]}, {d} de {mon}
        </Text>
        {date === data.today && <Text style={styles.todayPill}>Hoy</Text>}
      </View>

      {!closedReason && <DayWod html={data.wodByDate[date]} />}

      {closedReason ? (
        <View style={styles.closed}>
          <Text style={styles.closedTitle}>El gimnasio no abre este día</Text>
          <Text style={styles.closedReason}>{closedReason}</Text>
          <Text style={styles.closedNote}>Si tienes membresía activa, ya te sumamos este día al vencimiento.</Text>
        </View>
      ) : daySchedules.length === 0 ? (
        <Card style={styles.empty}>
          <Text style={styles.emptyText}>Sin clases programadas para este día.</Text>
        </Card>
      ) : (
        daySchedules.map((s) => (
          <ClassCard
            key={s.id}
            memberId={memberId}
            schedule={s}
            date={date}
            isToday={date === data.today}
            nowHour={nowHour}
            hasActiveMembership={data.hasActiveMembership}
            myBookingMap={myBookingMap}
            bookingCounts={data.bookingCounts}
          />
        ))
      )}

      {upcoming.length > 0 && (
        <View style={styles.upcoming}>
          <Text style={styles.upcomingTitle}>Mis próximas reservas</Text>
          {upcoming.slice(0, 5).map((b) => {
            const sched = data.schedules.find((s) => s.id === b.schedule_id);
            if (!sched) return null;
            const bd = dayNum(b.booking_date);
            const slot = b.start_time
              ? `${fmt12h(b.start_time)}${b.end_time ? `–${fmt12h(b.end_time)}` : ''}`
              : fmt12h(sched.start_time);
            return (
              <View key={b.id} style={styles.upcomingRow}>
                <Text style={styles.upcomingName}>{sched.name}</Text>
                <Text style={styles.upcomingWhen}>
                  {DAY_SHORT[dowOf(b.booking_date)]} {bd.d} {bd.mon} · {slot}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  loading: { marginTop: space.xxl },
  warn: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: radius.lg,
    padding: space.lg,
  },
  warnTitle: { fontFamily: fonts.bodySemi, fontSize: 14, color: '#fcd34d' },
  warnText: { fontFamily: fonts.body, fontSize: 13, color: colors.fgDim, marginTop: 2 },
  warnAction: { marginTop: space.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dayHeaderText: { fontFamily: fonts.condSemi, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: colors.fgDim },
  todayPill: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.accent,
    backgroundColor: 'rgba(232,75,31,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  closed: {
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.3)',
    borderRadius: radius.lg,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  closedTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#fecaca' },
  closedReason: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim, marginTop: space.xs },
  closedNote: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: space.md, textAlign: 'center' },
  empty: { paddingVertical: space.xxl, alignItems: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.fgMute },
  upcoming: {
    backgroundColor: 'rgba(232,75,31,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(232,75,31,0.2)',
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  upcomingTitle: { fontFamily: fonts.cond, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent },
  upcomingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  upcomingName: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg, flexShrink: 1 },
  upcomingWhen: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
});
