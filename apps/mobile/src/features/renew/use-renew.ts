// Renovar y pagos: mismas consultas que apps/web/app/portal/renovar. La
// solicitud se envía por POST /api/app/renewals (avisa al admin por push).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const RECEIPTS = 'payment-receipts';

export type Plan = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  color: string | null;
  is_exclusive: boolean;
};

export type Bank = {
  bank_name: string | null;
  account_type: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_doc: string | null;
  payment_note: string | null;
} | null;

export type Pending = {
  plan_name: string;
  amount: number;
  receipt_url: string | null;
} | null;

export type Sale = {
  id: string;
  sale_date: string;
  total: number;
  payment_method: string;
  bank_reference: string | null;
  notes: string | null;
};

export function useRenew(memberId: string) {
  return useQuery({
    queryKey: ['renew', memberId],
    queryFn: async () => {
      const [membershipRes, plansRes, bankRes, salesRes, pendingRes, accessRes] = await Promise.all([
        supabase
          .from('vw_memberships_status')
          .select('end_date, effective_status, days_until_expiry, membership_plans(name, price)')
          .eq('member_id', memberId)
          .in('status', ['active', 'frozen', 'expired'])
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('membership_plans')
          .select('id, name, price, duration_days, color, is_exclusive')
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('gym_settings')
          .select('bank_name, account_type, account_number, account_holder, account_doc, payment_note')
          .eq('id', 1)
          .maybeSingle(),
        supabase
          .from('sales')
          .select('id, sale_date, total, payment_method, bank_reference, notes')
          .eq('member_id', memberId)
          .is('voided_at', null)
          .order('sale_date', { ascending: false }),
        supabase
          .from('renewal_requests')
          .select('amount, receipt_url, membership_plans(name)')
          .eq('member_id', memberId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('plan_member_access').select('plan_id').eq('member_id', memberId),
      ]);
      const failed = [membershipRes, plansRes, salesRes, pendingRes].find((r) => r.error);
      if (failed?.error) throw failed.error;

      // Planes visibles: públicos + exclusivos donde el socio está autorizado.
      const allowed = new Set((accessRes.data ?? []).map((a) => a.plan_id as string));
      const plans = ((plansRes.data ?? []) as Plan[])
        .filter((p) => !p.is_exclusive || allowed.has(p.id))
        .map((p) => ({ ...p, price: Number(p.price), duration_days: Number(p.duration_days) }));

      // Comprobante pendiente: bucket privado → URL firmada (filas viejas: URL pública).
      const pr = pendingRes.data as unknown as { amount: number; receipt_url: string | null; membership_plans: { name: string } | null } | null;
      let receiptUrl: string | null = null;
      if (pr?.receipt_url) {
        const marker = `/object/public/${RECEIPTS}/`;
        const i = pr.receipt_url.indexOf(marker);
        const path = i >= 0 ? decodeURIComponent(pr.receipt_url.slice(i + marker.length)) : pr.receipt_url;
        const { data } = await supabase.storage.from(RECEIPTS).createSignedUrl(path, 3600);
        receiptUrl = data?.signedUrl ?? null;
      }

      const m = membershipRes.data as unknown as {
        end_date: string;
        effective_status: string;
        days_until_expiry: number;
        membership_plans: { name: string } | null;
      } | null;

      return {
        membership: m,
        plans,
        bank: (bankRes.data ?? null) as Bank,
        sales: ((salesRes.data ?? []) as Sale[]).map((s) => ({ ...s, total: Number(s.total) })),
        pending: pr
          ? { plan_name: pr.membership_plans?.name ?? 'Plan', amount: Number(pr.amount ?? 0), receipt_url: receiptUrl }
          : null,
      };
    },
  });
}

export type Receipt = { uri: string; mimeType: string; name: string };

export function useSendRenewal(memberId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { plan: Plan; method: string; receipt: Receipt; note: string }) => {
      // El RLS de storage solo deja subir archivos que empiecen por el uid.
      const ext = v.receipt.name.split('.').pop()?.toLowerCase() || v.receipt.mimeType.split('/')[1] || 'jpg';
      const body = await (await fetch(v.receipt.uri)).arrayBuffer();
      const { data, error } = await supabase.storage
        .from(RECEIPTS)
        .upload(`${userId}-${Date.now()}.${ext}`, body, { contentType: v.receipt.mimeType });
      if (error) throw new Error(`No se pudo subir el comprobante: ${error.message}`);

      await api('/api/app/renewals', {
        method: 'POST',
        body: {
          planId: v.plan.id,
          amount: v.plan.price,
          paymentMethod: v.method,
          receiptPath: data.path,
          memberNote: v.note.trim() || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renew', memberId] });
    },
  });
}
