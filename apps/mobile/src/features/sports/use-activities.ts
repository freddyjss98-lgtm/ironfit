// Actividades fuera del box (tabla activities). Se registran con la RPC
// log_activity, que además marca los retos que cumplan y, si el socio quiere,
// la publica en la comunidad.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { removeCommunityPhoto, uploadCommunityPhoto, type PickedPhoto } from '@/features/community/photo';
import { supabase } from '@/lib/supabase';

import type { Sport } from './sports';

export type Activity = {
  id: string;
  sport: Sport;
  title: string | null;
  started_at: string;
  duration_seconds: number;
  distance_m: number | null;
  elevation_m: number | null;
  calories: number | null;
  calories_estimated: boolean;
  source: 'manual' | 'gps' | 'health';
  notes: string | null;
  route_polyline: string | null;
};

export function useActivities(memberId: string) {
  return useQuery({
    queryKey: ['activities', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, sport, title, started_at, duration_seconds, distance_m, elevation_m, calories, calories_estimated, source, notes, route_polyline')
        .eq('member_id', memberId)
        .order('started_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}

/** Último peso registrado en Cuerpo (para estimar calorías). */
export function useLatestWeight(memberId: string) {
  return useQuery({
    queryKey: ['latest-weight', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_progress')
        .select('weight')
        .eq('member_id', memberId)
        .not('weight', 'is', null)
        .order('measured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.weight == null ? null : Number(data.weight);
    },
  });
}

export type ActivityInput = {
  sport: Sport;
  started_at: string;
  duration_seconds: number;
  distance_m: number | null;
  elevation_m: number | null;
  calories: number | null;
  calories_estimated: boolean;
  notes: string | null;
  share: boolean;
  photo: PickedPhoto | null;
  /** Solo las grabadas con el GPS de la app. */
  gps?: { route_polyline: string | null };
};

export function useLogActivity(memberId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: ActivityInput) => {
      const photoPath = v.share && v.photo ? await uploadCommunityPhoto(userId, v.photo) : null;
      const { data, error } = await supabase.rpc('log_activity', {
        p_sport: v.sport,
        p_started_at: v.started_at,
        p_duration_seconds: v.duration_seconds,
        p_distance_m: v.distance_m,
        p_elevation_m: v.elevation_m,
        p_calories: v.calories,
        p_calories_estimated: v.calories_estimated,
        p_notes: v.notes,
        p_share: v.share,
        p_photo_path: photoPath,
        ...(v.gps ? { p_source: 'gps', p_route_polyline: v.gps.route_polyline } : {}),
      });
      if (error) {
        await removeCommunityPhoto(photoPath);
        throw new Error(error.message);
      }
      return data as { activity_id: string; completed: string[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', memberId] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useDeleteActivity(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Su publicación (si la hay) se borra en cascada: antes se guarda la foto.
      const { data: posts } = await supabase.from('community_posts').select('photo_path').eq('activity_id', id);
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await Promise.all((posts ?? []).map((p) => removeCommunityPhoto(p.photo_path as string | null)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', memberId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
