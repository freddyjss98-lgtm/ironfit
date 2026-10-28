// Retos del gimnasio y comunidad (RPC challenge_list, complete_challenge,
// community_feed, report_post, block_post_author). Las fotos están en un
// bucket privado: cada página del feed pide sus URLs firmadas de una vez.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

import { COMMUNITY_BUCKET, removeCommunityPhoto, uploadCommunityPhoto, type PickedPhoto } from './photo';

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  sport: string;
  goal_type: 'distance' | 'time' | 'free';
  goal_distance_m: number | null;
  goal_seconds: number | null;
  starts_on: string;
  ends_on: string;
  completed_count: number;
  my_entry_id: string | null;
};

export type Post = {
  id: string;
  created_at: string;
  is_mine: boolean;
  display_name: string;
  avatar_url: string | null;
  caption: string | null;
  photo_path: string | null;
  photo_url: string | null;
  challenge_title: string | null;
  sport: string | null;
  duration_seconds: number | null;
  distance_m: number | null;
  elevation_m: number | null;
  calories: number | null;
  fire_count: number;
  fired: boolean;
};

const PAGE = 15;

export function useChallenges(enabled: boolean) {
  return useQuery({
    queryKey: ['challenges'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('challenge_list');
      if (error) throw error;
      return (data ?? []) as Challenge[];
    },
  });
}

export function useCompleteChallenge(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { challengeId: string; activityId: string | null; note: string; share: boolean; photo: PickedPhoto | null }) => {
      const photoPath = v.share && v.photo ? await uploadCommunityPhoto(userId, v.photo) : null;
      const { error } = await supabase.rpc('complete_challenge', {
        p_challenge: v.challengeId,
        p_activity: v.activityId,
        p_note: v.note.trim() || null,
        p_share: v.share,
        p_photo_path: photoPath,
      });
      if (error) {
        await removeCommunityPhoto(photoPath);
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/** Deshacer "reto cumplido": borra la marca y su publicación. */
export function useUndoChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { data: post } = await supabase
        .from('community_posts')
        .select('photo_path')
        .eq('challenge_entry_id', entryId)
        .maybeSingle();
      const { error } = await supabase.from('challenge_entries').delete().eq('id', entryId);
      if (error) throw new Error(error.message);
      await removeCommunityPhoto(post?.photo_path as string | null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

export function useFeed(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['feed'],
    enabled,
    initialPageParam: null as string | null,
    getNextPageParam: (last: Post[]) => (last.length < PAGE ? null : last[last.length - 1].created_at),
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('community_feed', { p_before: pageParam, p_limit: PAGE });
      if (error) throw error;
      const rows = (data ?? []) as Omit<Post, 'photo_url'>[];
      const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from(COMMUNITY_BUCKET).createSignedUrls(paths, 60 * 60);
        for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      }
      return rows.map((r) => ({ ...r, photo_url: r.photo_path ? (urls.get(r.photo_path) ?? null) : null }));
    },
  });
}

/** 🔥: se marca al instante en pantalla y se guarda detrás. */
export function useToggleFire(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Post) => {
      const { error } = post.fired
        ? await supabase.from('post_reactions').delete().eq('post_id', post.id).eq('member_id', memberId)
        : await supabase.from('post_reactions').insert({ post_id: post.id, member_id: memberId });
      if (error) throw new Error(error.message);
    },
    onMutate: (post: Post) => {
      queryClient.setQueryData<{ pages: Post[][]; pageParams: unknown[] }>(['feed'], (old) =>
        old && {
          ...old,
          pages: old.pages.map((page) =>
            page.map((p) =>
              p.id === post.id ? { ...p, fired: !post.fired, fire_count: p.fire_count + (post.fired ? -1 : 1) } : p
            )
          ),
        }
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

function dropFromFeed(queryClient: ReturnType<typeof useQueryClient>, keep: (p: Post) => boolean) {
  queryClient.setQueryData<{ pages: Post[][]; pageParams: unknown[] }>(['feed'], (old) =>
    old && { ...old, pages: old.pages.map((page) => page.filter(keep)) }
  );
}

export function useReportPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { post: Post; reason: string }) => {
      const { error } = await supabase.rpc('report_post', { p_post: v.post.id, p_reason: v.reason });
      if (error) throw new Error(error.message);
      // Aviso push al staff (best-effort: el reporte ya quedó guardado).
      api('/api/app/community/reported', { method: 'POST', body: { postId: v.post.id } }).catch(() => {});
    },
    onSuccess: (_d, v) => dropFromFeed(queryClient, (p) => p.id !== v.post.id),
  });
}

export function useBlockAuthor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Post) => {
      const { error } = await supabase.rpc('block_post_author', { p_post: post.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (post: Post) => {
      const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
      if (error) throw new Error(error.message);
      await removeCommunityPhoto(post.photo_path);
    },
    onSuccess: (_d, post) => dropFromFeed(queryClient, (p) => p.id !== post.id),
  });
}

/** ¿Ya aceptó las reglas de la comunidad? */
export function useCommunityTerms(memberId: string) {
  return useQuery({
    queryKey: ['community-terms', memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('community_terms_at').eq('id', memberId).single();
      if (error) throw error;
      return !!data.community_terms_at;
    },
  });
}

export function useAcceptTerms(memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('accept_community_terms');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.setQueryData(['community-terms', memberId], true),
  });
}
