import { createClient } from "@/lib/supabase/server";
import { addDays, todayInEcuador } from "@ironfit/shared/date";
import { purgeClosedChallengePhotos } from "@/lib/services/challenges";
import RetosClient, { type ChallengeRow, type PostRow } from "./RetosClient";

type MemberRef = { full_name: string } | null;

export default async function RetosPage() {
  const supabase = await createClient();
  const today = todayInEcuador();

  // Por si el cron de las 9:00 falló: la limpieza de fotos de los retos
  // cerrados también corre al abrir esta pantalla. Es idempotente.
  await purgeClosedChallengePhotos(supabase).catch((err) => console.error("[retos] purge", err));

  const [{ data: challenges }, { data: entries }, { data: reports }, { data: posts }] = await Promise.all([
    supabase
      .from("challenges")
      .select("id, title, description, sport, goal_type, goal_distance_m, goal_seconds, starts_on, ends_on")
      .gte("ends_on", addDays(today, -60))
      .order("starts_on", { ascending: false }),
    supabase.from("challenge_entries").select("challenge_id"),
    supabase.from("post_reports").select("post_id, reason, created_at").is("resolved_at", null),
    supabase
      .from("community_posts")
      .select(
        "id, created_at, caption, photo_path, hidden_at, members(full_name), challenge_entries(challenges(title)), activities(sport, distance_m, duration_seconds)"
      )
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const doneBy = new Map<string, number>();
  for (const e of entries ?? []) doneBy.set(e.challenge_id as string, (doneBy.get(e.challenge_id as string) ?? 0) + 1);

  const reportsBy = new Map<string, { count: number; reasons: string[] }>();
  for (const r of reports ?? []) {
    const cur = reportsBy.get(r.post_id as string) ?? { count: 0, reasons: [] };
    cur.count++;
    if (r.reason) cur.reasons.push(r.reason as string);
    reportsBy.set(r.post_id as string, cur);
  }

  // Las reportadas pueden ser más viejas que las 40 recientes: se traen aparte.
  const recentIds = new Set((posts ?? []).map((p) => p.id as string));
  const missing = [...reportsBy.keys()].filter((id) => !recentIds.has(id));
  const { data: reportedOld } = missing.length
    ? await supabase
        .from("community_posts")
        .select(
          "id, created_at, caption, photo_path, hidden_at, members(full_name), challenge_entries(challenges(title)), activities(sport, distance_m, duration_seconds)"
        )
        .in("id", missing)
    : { data: [] };
  const allPosts = [...(posts ?? []), ...(reportedOld ?? [])];

  // Fotos del bucket privado: URL firmada por 1 h.
  const paths = allPosts.map((p) => p.photo_path as string | null).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("community").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const postRows: PostRow[] = allPosts.map((p) => {
    const entry = p.challenge_entries as unknown as { challenges: { title: string } | null } | null;
    const act = p.activities as unknown as { sport: string; distance_m: number | null; duration_seconds: number } | null;
    const rep = reportsBy.get(p.id as string);
    return {
      id: p.id as string,
      createdAt: p.created_at as string,
      author: (p.members as unknown as MemberRef)?.full_name ?? "Socio",
      caption: (p.caption as string | null) ?? null,
      photoUrl: p.photo_path ? (urls.get(p.photo_path as string) ?? null) : null,
      challengeTitle: entry?.challenges?.title ?? null,
      sport: act?.sport ?? null,
      distanceM: act?.distance_m ?? null,
      durationSeconds: act?.duration_seconds ?? null,
      hidden: !!p.hidden_at,
      reports: rep?.count ?? 0,
      reportReasons: rep?.reasons ?? [],
    };
  });

  const challengeRows: ChallengeRow[] = (challenges ?? []).map((c) => ({
    id: c.id as string,
    title: c.title as string,
    description: (c.description as string | null) ?? null,
    sport: c.sport as string,
    goalType: c.goal_type as ChallengeRow["goalType"],
    goalDistanceM: (c.goal_distance_m as number | null) ?? null,
    goalSeconds: (c.goal_seconds as number | null) ?? null,
    startsOn: c.starts_on as string,
    endsOn: c.ends_on as string,
    completed: doneBy.get(c.id as string) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl uppercase tracking-tight">Retos y comunidad</h2>
        <p className="text-fg/40 text-sm mt-0.5 max-w-2xl">
          Publica retos para los socios de la app (correr 5K, nadar 30 min, subir una montaña). Ellos
          los marcan como cumplidos y comparten su foto en la comunidad. Revisa aquí lo que reportan:
          Apple y Google exigen atender cada reporte en menos de 24 horas.
        </p>
      </div>

      <RetosClient challenges={challengeRows} posts={postRows} today={today} />
    </div>
  );
}
