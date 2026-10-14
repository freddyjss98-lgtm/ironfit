// Perfil del socio: mismas consultas y escrituras que apps/web/app/portal/perfil.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type Profile = {
  full_name: string;
  phone: string;
  email: string | null;
  birthday: string | null;
  photo_url: string | null;
  gender: string | null;
  height_cm: number | null;
  goal: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string | null;
};

export type ProfileMembership = {
  status: string;
  days_left: number | null;
  plan_name: string | null;
};

export function useProfile(memberId: string) {
  return useQuery({
    queryKey: ['profile', memberId],
    queryFn: async () => {
      const [full, membership] = await Promise.all([
        supabase
          .from('members')
          .select(
            'full_name, phone, email, birthday, photo_url, gender, height_cm, goal, emergency_contact_name, emergency_contact_phone, created_at'
          )
          .eq('id', memberId)
          .single(),
        supabase
          .from('vw_memberships_status')
          .select('effective_status, days_until_expiry, membership_plans(name)')
          .eq('member_id', memberId)
          .in('status', ['active', 'frozen', 'expired'])
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (full.error) throw full.error;
      const m = membership.data as unknown as {
        effective_status: string;
        days_until_expiry: number | null;
        membership_plans: { name: string } | null;
      } | null;
      return {
        profile: full.data as Profile,
        membership: {
          status: m?.effective_status ?? 'no_membership',
          days_left: m?.days_until_expiry ?? null,
          plan_name: m?.membership_plans?.name ?? null,
        } satisfies ProfileMembership,
      };
    },
  });
}

export type ProfileForm = {
  full_name: string;
  phone: string;
  email: string;
  birthday: string;
  gender: string;
  height_cm: string;
  goal: string;
  emergency_contact_name: string;
};

const orNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Sube la foto elegida al bucket member-photos y devuelve su URL pública. */
async function uploadPhoto(userId: string, uri: string, mimeType: string | undefined): Promise<string> {
  const ext = mimeType?.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const body = await (await fetch(uri)).arrayBuffer();
  const { data, error } = await supabase.storage
    .from('member-photos')
    .upload(`${userId}-${Date.now()}.${ext}`, body, { contentType: mimeType ?? 'image/jpeg' });
  if (error) throw new Error(error.message);
  return supabase.storage.from('member-photos').getPublicUrl(data.path).data.publicUrl;
}

export function useSaveProfile(memberId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      form,
      current,
      photo,
    }: {
      form: ProfileForm;
      current: Profile;
      photo: { uri: string; mimeType?: string } | null;
    }) => {
      if (!form.full_name.trim() || !form.phone.trim()) throw new Error('Nombre y teléfono son obligatorios.');
      const height = form.height_cm.trim() === '' ? null : Number(form.height_cm.replace(',', '.'));
      if (height !== null && !Number.isFinite(height)) throw new Error('La estatura debe ser un número.');

      const photoUrl = photo ? await uploadPhoto(userId, photo.uri, photo.mimeType) : current.photo_url;

      // Misma RPC que el portal web: el socio solo puede tocar estos campos.
      const { error } = await supabase.rpc('update_my_profile', {
        p_full_name: form.full_name.trim(),
        p_phone: form.phone.trim(),
        p_email: orNull(form.email),
        p_birthday: orNull(form.birthday),
        p_gender: orNull(form.gender),
        p_height_cm: height,
        p_goal: orNull(form.goal),
        p_emergency_contact_name: orNull(form.emergency_contact_name),
        p_emergency_contact_phone: current.emergency_contact_phone,
        p_photo_url: photoUrl,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', memberId] });
      queryClient.invalidateQueries({ queryKey: ['member'] });
    },
  });
}

export async function changePassword(password: string): Promise<void> {
  if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

/** Borra la cuenta en el servidor (datos personales fuera, historial anonimizado). */
export async function deleteAccount(): Promise<void> {
  await api('/api/app/account', { method: 'DELETE' });
}
