// Piezas de la pantalla "Entrenar", equivalentes a PortalClasesClient.tsx.

import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/card';
import { htmlToSegments } from '@/lib/html';
import { colors, fonts, radius, space } from '@/theme';

import { dowOf, useBookClass, useCancelBooking, type MyBooking, type Schedule } from './use-classes';

export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function dayNum(ymd: string) {
  const [, m, d] = ymd.split('-').map(Number);
  return { d, mon: MONTH_SHORT[m - 1] };
}

export function fmt12h(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Divide la ventana de la clase en bloques de 1 hora ("HH:MM:SS"). */
function slotsOf(start: string, end: string) {
  const sh = parseInt(start.split(':')[0], 10);
  const eh = parseInt(end.split(':')[0], 10);
  const out: { start: string; end: string }[] = [];
  for (let h = sh; h < eh; h++) out.push({ start: `${pad(h)}:00:00`, end: `${pad(h + 1)}:00:00` });
  return out;
}

// ── Tira de días ─────────────────────────────────────────────────────────────
export function DateStrip({
  dates,
  today,
  selected,
  onSelect,
  schedules,
  myBookings,
  closedDays,
}: {
  dates: string[];
  today: string;
  selected: string;
  onSelect: (d: string) => void;
  schedules: Schedule[];
  myBookings: MyBooking[];
  closedDays: Record<string, string>;
}) {
  return (
    <View style={styles.strip}>
      {dates.map((date) => {
        const dow = dowOf(date);
        const { d, mon } = dayNum(date);
        const isSel = date === selected;
        const closed = !!closedDays[date];
        const hasClasses = schedules.some((s) => s.day_of_week === dow);
        const mine = myBookings.filter((b) => b.booking_date === date && b.status === 'confirmed').length;
        const tone = isSel
          ? closed
            ? styles.daySelClosed
            : styles.daySel
          : closed
            ? styles.dayClosed
            : date === today
              ? styles.dayToday
              : hasClasses
                ? null
                : styles.dayEmpty;
        const textColor = isSel ? '#fff' : closed ? '#fca5a5' : date === today ? colors.accent : hasClasses ? colors.fgDim : colors.fgMute;
        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${DAY_FULL[dow]} ${d} de ${mon}${closed ? ', cerrado' : ''}${mine ? `, ${mine} reserva` : ''}`}
            style={[styles.day, tone]}>
            <Text style={[styles.dayName, { color: textColor }]}>{DAY_SHORT[dow]}</Text>
            <Text style={[styles.dayDate, { color: textColor }]}>{d}</Text>
            {closed ? <Text style={[styles.dayTag, { color: textColor }]}>CERR.</Text> : null}
            {mine > 0 && (
              <View style={[styles.dayBadge, isSel && styles.dayBadgeSel]}>
                <Text style={styles.dayBadgeText}>{mine}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Planificación del día ────────────────────────────────────────────────────
export function DayWod({ html }: { html: string | undefined }) {
  const segments = html ? htmlToSegments(html) : [];
  if (segments.every((s) => !s.text.trim())) return null;
  return (
    <View style={styles.wod}>
      <Text style={styles.wodTitle}>🗓️ Planificación del día</Text>
      <Text style={styles.wodText}>
        {segments.map((s, i) =>
          s.bold || s.color ? (
            <Text key={i} style={[s.bold && styles.wodBold, s.color ? { color: s.color } : null]}>
              {s.text}
            </Text>
          ) : (
            s.text
          )
        )}
      </Text>
    </View>
  );
}

// ── Clase con sus turnos ─────────────────────────────────────────────────────
export function ClassCard({
  memberId,
  schedule,
  date,
  isToday,
  nowHour,
  hasActiveMembership,
  myBookingMap,
  bookingCounts,
}: {
  memberId: string;
  schedule: Schedule;
  date: string;
  isToday: boolean;
  nowHour: number;
  hasActiveMembership: boolean;
  myBookingMap: Record<string, MyBooking>;
  bookingCounts: Record<string, number>;
}) {
  const slots = slotsOf(schedule.start_time, schedule.end_time);
  return (
    <Card style={styles.classCard}>
      <View style={styles.classHeader}>
        <Text style={styles.className}>{schedule.name}</Text>
        <Text style={styles.small}>
          {fmt12h(schedule.start_time)} – {fmt12h(schedule.end_time)}
          {schedule.coach_name ? ` · ${schedule.coach_name}` : ''}
        </Text>
        {schedule.description ? <Text style={styles.small}>{schedule.description}</Text> : null}
      </View>
      {slots.map((slot) => {
        const key = `${schedule.id}|${date}|${slot.start}`;
        return (
          <SlotRow
            key={slot.start}
            memberId={memberId}
            scheduleId={schedule.id}
            date={date}
            slot={slot}
            myBooking={myBookingMap[key] ?? null}
            spotsLeft={schedule.max_capacity - (bookingCounts[key] ?? 0)}
            isPast={isToday && parseInt(slot.start, 10) < nowHour}
            hasActiveMembership={hasActiveMembership}
          />
        );
      })}
    </Card>
  );
}

function SlotRow({
  memberId,
  scheduleId,
  date,
  slot,
  myBooking,
  spotsLeft,
  isPast,
  hasActiveMembership,
}: {
  memberId: string;
  scheduleId: string;
  date: string;
  slot: { start: string; end: string };
  myBooking: MyBooking | null;
  spotsLeft: number;
  isPast: boolean;
  hasActiveMembership: boolean;
}) {
  const book = useBookClass(memberId);
  const cancel = useCancelBooking(memberId);
  const pending = book.isPending || cancel.isPending;
  const isBooked = myBooking !== null;
  const isFull = spotsLeft <= 0;
  const label = `${fmt12h(slot.start)} – ${fmt12h(slot.end)}`;

  const onError = (title: string) => (err: Error) => Alert.alert(title, err.message);

  function onBook() {
    book.mutate({ scheduleId, date, start: slot.start, end: slot.end }, { onError: onError('No se pudo reservar') });
  }

  function onCancel() {
    if (!myBooking) return;
    Alert.alert('Cancelar reserva', `¿Cancelar tu reserva de ${label}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () => cancel.mutate(myBooking.id, { onError: onError('No se pudo cancelar') }),
      },
    ]);
  }

  const status = isPast
    ? { text: 'Horario pasado', color: colors.fgMute }
    : isFull
      ? { text: 'Sin cupos', color: '#f87171' }
      : spotsLeft <= 3
        ? { text: `¡Solo ${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''}!`, color: '#fbbf24' }
        : { text: `${spotsLeft} cupo${spotsLeft !== 1 ? 's' : ''}`, color: colors.fgMute };

  return (
    <View style={[styles.slot, isBooked && styles.slotBooked, isPast && !isBooked && styles.slotPast]}>
      <View style={styles.flex}>
        <Text style={styles.slotTime}>{label}</Text>
        {isBooked ? (
          <Text style={[styles.slotStatus, { color: colors.accent }]}>Reservado ✓</Text>
        ) : (
          <Text style={[styles.slotStatus, { color: status.color }]}>{status.text}</Text>
        )}
      </View>
      {pending ? (
        <ActivityIndicator color={colors.accent} />
      ) : isBooked ? (
        <Pressable onPress={onCancel} style={styles.btnGhost} accessibilityRole="button">
          <Text style={styles.btnGhostText}>Cancelar</Text>
        </Pressable>
      ) : isPast ? (
        <Text style={styles.small}>—</Text>
      ) : (
        <Pressable
          onPress={onBook}
          disabled={isFull || !hasActiveMembership}
          style={[styles.btn, (isFull || !hasActiveMembership) && styles.btnOff]}
          accessibilityRole="button"
          accessibilityState={{ disabled: isFull || !hasActiveMembership }}>
          <Text style={styles.btnText}>{isFull ? 'Llena' : 'Reservar'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },

  strip: { flexDirection: 'row', gap: 5 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 2,
  },
  daySel: { backgroundColor: colors.accent, borderColor: colors.accent },
  daySelClosed: { backgroundColor: 'rgba(239,68,68,0.25)', borderColor: 'rgba(248,113,113,0.5)' },
  dayClosed: { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(248,113,113,0.2)' },
  dayToday: { backgroundColor: 'rgba(232,75,31,0.10)', borderColor: 'rgba(232,75,31,0.3)' },
  dayEmpty: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(36,36,36,0.3)' },
  dayName: { fontFamily: fonts.bodySemi, fontSize: 12 },
  dayDate: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  dayTag: { fontFamily: fonts.cond, fontSize: 9, letterSpacing: 0.5 },
  dayBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeSel: { backgroundColor: 'rgba(255,255,255,0.25)' },
  dayBadgeText: { fontFamily: fonts.bodySemi, fontSize: 10, color: '#fff' },

  wod: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(232,75,31,0.3)',
    borderRadius: radius.lg,
    padding: space.lg,
  },
  wodTitle: { fontFamily: fonts.cond, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: colors.accent, marginBottom: space.sm },
  wodText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.fg },
  wodBold: { fontFamily: fonts.bodySemi },

  classCard: { padding: 0, overflow: 'hidden' },
  classHeader: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: 'rgba(36,36,36,0.6)' },
  className: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.fg },

  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(36,36,36,0.4)',
  },
  slotBooked: { backgroundColor: 'rgba(232,75,31,0.07)' },
  slotPast: { opacity: 0.45 },
  slotTime: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  slotStatus: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  btnOff: { opacity: 0.4 },
  btnText: { fontFamily: fonts.bodySemi, fontSize: 13, color: '#fff' },
  btnGhost: { borderWidth: 1, borderColor: colors.line2, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  btnGhostText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.fgDim },
});
