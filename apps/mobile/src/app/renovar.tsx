import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, SectionLabel } from '@/components/card';
import { Choice } from '@/components/choice';
import { Notice } from '@/components/notice';
import { Screen } from '@/components/screen';
import { Body, Title } from '@/components/text';
import { useRenew, useSendRenewal, type Bank, type Plan, type Receipt } from '@/features/renew/use-renew';
import { useAuth } from '@/lib/auth';
import { GYM_WHATSAPP } from '@/lib/config';
import { fmtShort } from '@/lib/dates';
import { fmtMoney, PAYMENT_METHODS } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme';

type Method = 'transfer' | 'cash' | 'card' | 'other';

export default function RenewScreen() {
  const { member, session } = useAuth();
  const renew = useRenew(member!.id);

  if (renew.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }
  if (renew.isError) {
    return (
      <Screen>
        <Notice message="No pudimos cargar la información. Revisa tu conexión." />
        <Button label="Reintentar" variant="secondary" onPress={() => renew.refetch()} />
      </Screen>
    );
  }

  const { membership, plans, bank, sales, pending } = renew.data;
  const expired = !membership || membership.effective_status === 'expired';
  const total = sales.reduce((s, x) => s + x.total, 0);
  const support = () =>
    Linking.openURL(
      `https://wa.me/${GYM_WHATSAPP}?text=${encodeURIComponent(
        `Hola Iron Fit! Soy *${member!.full_name}* y necesito ayuda con mi renovación / pago.`
      )}`
    );

  return (
    <Screen onRefresh={() => renew.refetch()} refreshing={renew.isRefetching}>
      <Body dim>Elige tu plan, paga y sube tu comprobante. El gym lo revisa y activa tu membresía.</Body>

      <Card style={styles.gap}>
        <SectionLabel>Plan actual</SectionLabel>
        <Text style={styles.planNow}>{membership?.membership_plans?.name ?? 'Sin plan activo'}</Text>
        {membership && (
          <View style={styles.row}>
            <Text style={styles.dim}>Vence el {fmtShort(membership.end_date)}</Text>
            <Text style={[styles.pill, { color: expired ? '#f87171' : '#34d399', backgroundColor: expired ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)' }]}>
              {expired ? 'Vencida' : `${membership.days_until_expiry} días restantes`}
            </Text>
          </View>
        )}
      </Card>

      {pending ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>⏳ Solicitud en revisión</Text>
          <Text style={styles.pendingText}>
            Enviaste una solicitud de <Text style={styles.bold}>{pending.plan_name}</Text> por{' '}
            <Text style={styles.bold}>{fmtMoney(pending.amount)}</Text>. El gym la revisará y activará tu membresía pronto.
          </Text>
          {pending.receipt_url && (
            <Pressable onPress={() => Linking.openURL(pending.receipt_url!)} accessibilityRole="link">
              <Text style={styles.link}>Ver comprobante enviado</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <RenewForm plans={plans} bank={bank} memberId={member!.id} userId={session!.user.id} />
      )}

      <Button label="¿Necesitas ayuda? Soporte por WhatsApp" variant="secondary" onPress={support} />

      <View style={styles.paymentsHeader}>
        <Title>Mis pagos</Title>
        <Body dim>Historial de pagos y recibos</Body>
      </View>
      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <SectionLabel>Total pagos</SectionLabel>
          <Text style={styles.tileValue}>{sales.length}</Text>
        </Card>
        <Card style={styles.tile}>
          <SectionLabel>Total pagado</SectionLabel>
          <Text style={[styles.tileValue, { color: colors.accent }]}>{fmtMoney(total)}</Text>
        </Card>
      </View>
      {sales.length === 0 ? (
        <Card>
          <Text style={[styles.dim, styles.center]}>Sin pagos registrados.</Text>
        </Card>
      ) : (
        <Card style={styles.list}>
          {sales.map((s, i) => (
            <View key={s.id} style={[styles.sale, i > 0 && styles.saleBorder]}>
              <View style={styles.flex}>
                <Text style={styles.saleDate}>
                  {fmtShort(s.sale_date)} · {PAYMENT_METHODS[s.payment_method] ?? s.payment_method}
                </Text>
                {s.notes ? <Text style={styles.small}>{s.notes}</Text> : null}
                {s.bank_reference ? <Text style={styles.small}>Ref: {s.bank_reference}</Text> : null}
              </View>
              <Text style={styles.saleTotal}>{fmtMoney(s.total)}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function bankIsEmpty(b: Bank) {
  return !b || (!b.bank_name && !b.account_number && !b.account_holder);
}

function RenewForm({ plans, bank, memberId, userId }: { plans: Plan[]; bank: Bank; memberId: string; userId: string }) {
  const send = useSendRenewal(memberId, userId);
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [method, setMethod] = useState<Method>('transfer');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [note, setNote] = useState('');
  const plan = plans.find((p) => p.id === planId) ?? null;

  async function copyAccount() {
    if (!bank?.account_number) return;
    await Clipboard.setStringAsync(bank.account_number);
    Alert.alert('Copiado', 'Número de cuenta copiado.');
  }

  async function fromImage(source: 'camera' | 'library') {
    const perm =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso necesario', 'Permite el acceso en los ajustes del teléfono para subir el comprobante.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const a = r.assets[0];
    setReceipt({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'comprobante.jpg' });
  }

  async function fromPdf() {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    setReceipt({ uri: a.uri, mimeType: a.mimeType ?? 'application/pdf', name: a.name });
  }

  function chooseReceipt() {
    Alert.alert('Comprobante de pago', undefined, [
      { text: 'Tomar foto', onPress: () => fromImage('camera') },
      { text: 'Elegir de la galería', onPress: () => fromImage('library') },
      { text: 'Archivo PDF', onPress: fromPdf },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function submit() {
    if (!plan) return Alert.alert('Falta el plan', 'Selecciona un plan.');
    if (!receipt) return Alert.alert('Falta el comprobante', 'Sube el comprobante de pago.');
    send.mutate(
      { plan, method, receipt, note },
      { onSuccess: () => Alert.alert('¡Solicitud enviada!', 'El gym la revisará pronto.') }
    );
  }

  return (
    <View style={styles.gapLg}>
      <View style={styles.gap}>
        <SectionLabel>1 · Elige tu plan</SectionLabel>
        {plans.length === 0 ? (
          <Text style={styles.dim}>No hay planes disponibles. Contacta al gym.</Text>
        ) : (
          plans.map((p) => {
            const active = p.id === planId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPlanId(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.plan, active && styles.planActive]}>
                <View style={styles.flex}>
                  <View style={styles.planNameRow}>
                    <View style={[styles.dot, { backgroundColor: p.color ?? colors.accent }]} />
                    <Text style={styles.planName}>{p.name}</Text>
                  </View>
                  {p.is_exclusive && <Text style={styles.exclusive}>★ Exclusivo para ti</Text>}
                  <Text style={styles.small}>{p.duration_days} días</Text>
                </View>
                <Text style={styles.planPrice}>{fmtMoney(p.price)}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.gap}>
        <SectionLabel>2 · Realiza el pago</SectionLabel>
        {bankIsEmpty(bank) ? (
          <Card>
            <Text style={styles.dim}>El gym aún no publicó los datos de pago. Coordina por el botón de soporte.</Text>
          </Card>
        ) : (
          <Card style={styles.gap}>
            {bank?.bank_name ? <BankRow label="Banco" value={bank.bank_name} /> : null}
            {bank?.account_type ? <BankRow label="Tipo de cuenta" value={bank.account_type} /> : null}
            {bank?.account_number ? (
              <View style={styles.row}>
                <Text style={styles.dim}>Número</Text>
                <View style={styles.copyRow}>
                  <Text style={styles.bankValue}>{bank.account_number}</Text>
                  <Pressable onPress={copyAccount} style={styles.copy} accessibilityRole="button">
                    <Text style={styles.copyText}>Copiar</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {bank?.account_holder ? <BankRow label="Titular" value={bank.account_holder} /> : null}
            {bank?.account_doc ? <BankRow label="C.I./RUC" value={bank.account_doc} /> : null}
            {bank?.payment_note ? <Text style={styles.small}>{bank.payment_note}</Text> : null}
          </Card>
        )}
      </View>

      <View style={styles.gap}>
        <SectionLabel>3 · Sube tu comprobante</SectionLabel>
        <Choice<Method>
          label="Método"
          value={method}
          onChange={setMethod}
          options={[
            { value: 'transfer', label: 'Transf.' },
            { value: 'cash', label: 'Efectivo' },
            { value: 'card', label: 'Tarjeta' },
            { value: 'other', label: 'Otro' },
          ]}
        />
        <Text style={styles.dim}>Monto: {plan ? fmtMoney(plan.price) : '—'}</Text>
        <Button label={receipt ? 'Cambiar comprobante' : 'Subir comprobante'} variant="secondary" onPress={chooseReceipt} />
        {receipt && <Text style={styles.small}>📎 {receipt.name}</Text>}
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Nota (opcional). Ej. transferí desde mi cuenta de Pichincha"
          placeholderTextColor={colors.fgMute}
          multiline
          style={styles.note}
        />
        {send.error && <Notice message={send.error.message} />}
        <Button label="Enviar solicitud de renovación" onPress={submit} loading={send.isPending} disabled={plans.length === 0} />
        <Text style={[styles.small, styles.center]}>El gym revisará tu comprobante y activará tu membresía.</Text>
      </View>
    </View>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.dim}>{label}</Text>
      <Text style={styles.bankValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: space.sm },
  gapLg: { gap: space.xl },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  dim: { fontFamily: fonts.body, fontSize: 14, color: colors.fgDim },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.fgMute, marginTop: 2 },
  bold: { fontFamily: fonts.bodySemi, color: colors.fg },
  planNow: { fontFamily: fonts.bodySemi, fontSize: 18, color: colors.fg },
  pill: { fontFamily: fonts.bodySemi, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  pending: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  pendingTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: '#fcd34d' },
  pendingText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.fgDim },
  link: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent, textDecorationLine: 'underline' },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    padding: space.md,
  },
  planActive: { borderColor: colors.accent, backgroundColor: 'rgba(232,75,31,0.10)' },
  planNameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  planName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.fg },
  exclusive: { fontFamily: fonts.cond, fontSize: 11, letterSpacing: 1, color: '#fcd34d', marginTop: 2 },
  planPrice: { fontFamily: fonts.display, fontSize: 22, color: colors.accent },
  bankValue: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg, textAlign: 'right', flexShrink: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  copy: { borderWidth: 1, borderColor: 'rgba(232,75,31,0.4)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  copyText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
  note: {
    minHeight: 64,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm + 2,
    padding: space.md,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.fg,
  },
  paymentsHeader: { marginTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.xl },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1 },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.fg, marginTop: space.xs },
  list: { padding: 0 },
  sale: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  saleBorder: { borderTopWidth: 1, borderTopColor: 'rgba(36,36,36,0.6)' },
  saleDate: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.fg },
  saleTotal: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.fg },
});
