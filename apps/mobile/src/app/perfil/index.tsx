import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { useProfile, type ProfileMembership } from '@/features/profile/use-profile';
import { BoardPrivacy } from '@/features/wod/board-privacy';
import { useAuth } from '@/lib/auth';
import { pushPermissionGranted, registerForPush } from '@/lib/push';
import { colors, fonts, radius, space } from '@/theme';

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fmtLong(s: string | null): string {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-').map(Number);
  return y && m && d ? `${d} de ${MES[m - 1]} ${y}` : '—';
}

function fmtBirthday(s: string | null): string {
  if (!s) return '—';
  const [, m, d] = s.split('-').map(Number);
  return m && d ? `${d} de ${MES[m - 1]}` : '—';
}

const GENDER: Record<string, string> = { M: 'Masculino', F: 'Femenino', other: 'Otro' };

function MembershipBadge({ m }: { m: ProfileMembership }) {
  const [text, color] =
    m.status === 'active'
      ? [`${m.plan_name ?? 'Activa'}${m.days_left != null ? ` · ${m.days_left}d` : ''}`, '#34d399']
      : m.status === 'expired'
        ? ['Vencida', '#f87171']
        : m.status === 'frozen'
          ? ['Congelada', '#93c5fd']
          : ['Sin membresía', colors.fgMute];
  return <Text style={[styles.badge, { color, backgroundColor: `${color}22` }]}>{text}</Text>;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { member, signOut } = useAuth();
  const profile = useProfile(member!.id);
  const [push, setPush] = useState<'unknown' | 'enabled' | 'off'>('unknown');

  useEffect(() => {
    pushPermissionGranted().then((granted) => setPush(granted ? 'enabled' : 'off'));
  }, []);

  async function enablePush() {
    const result = await registerForPush(true);
    if (result === 'enabled') setPush('enabled');
    else if (result === 'denied')
      Alert.alert('Notificaciones desactivadas', 'Actívalas para Iron Fit en los ajustes del teléfono.');
    else Alert.alert('No disponible', 'Las notificaciones estarán disponibles en la versión instalada desde la tienda.');
  }

  if (profile.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      </Screen>
    );
  }
  if (profile.isError) {
    return (
      <Screen>
        <Notice message="No pudimos cargar tu perfil. Revisa tu conexión." />
        <Button label="Reintentar" variant="secondary" onPress={() => profile.refetch()} />
      </Screen>
    );
  }

  const { profile: p, membership } = profile.data;
  const rows: [string, string][] = [
    ['Teléfono', p.phone || '—'],
    ['Correo', p.email || '—'],
    ['Cumpleaños', fmtBirthday(p.birthday)],
    ['Género', (p.gender && GENDER[p.gender]) || '—'],
    ['Estatura', p.height_cm ? `${p.height_cm} cm` : '—'],
    ['Objetivo', p.goal || '—'],
    ['Contacto de emergencia', p.emergency_contact_name || '—'],
  ];

  return (
    <Screen onRefresh={() => profile.refetch()} refreshing={profile.isRefetching}>
      <Card style={styles.header}>
        <Avatar name={p.full_name} url={p.photo_url} />
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={2}>
            {p.full_name || '—'}
          </Text>
          <MembershipBadge m={membership} />
          {p.created_at && <Text style={styles.since}>Socio desde {fmtLong(p.created_at)}</Text>}
        </View>
      </Card>

      <Card style={styles.rows}>
        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
          </View>
        ))}
      </Card>

      <BoardPrivacy memberId={member!.id} />

      <Button label="Editar perfil" onPress={() => router.push('/perfil/editar')} />
      <Button label="Cambiar contraseña" variant="secondary" onPress={() => router.push('/perfil/clave')} />
      {push === 'off' && <Button label="Activar notificaciones" variant="secondary" onPress={enablePush} />}

      <View style={styles.danger}>
        <Button label="Cerrar sesión" variant="ghost" onPress={() => signOut()} />
        <Button label="Eliminar mi cuenta" variant="ghost" onPress={() => router.push('/perfil/eliminar')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  loading: { marginTop: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { fontFamily: fonts.display, fontSize: 22, color: colors.fg, textTransform: 'uppercase' },
  badge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  since: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute },
  rows: { padding: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  rowLabel: { fontFamily: fonts.condSemi, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.fgMute },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg, flexShrink: 1, textAlign: 'right' },
  danger: { marginTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.md, borderRadius: radius.sm },
});
