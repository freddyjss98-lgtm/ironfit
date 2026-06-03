// =============================================================================
// Attendance analytics — streaks, weekly goal, achievements
// =============================================================================
// Pure functions that turn a list of check-in dates into the retention metrics
// the member portal shows. Gym is closed Sundays, so Sundays never break a
// streak (grace day).
// =============================================================================

const GYM_CLOSED_DOW = 0; // Sunday

/** Convert "YYYY-MM-DD" to a stable integer day index (UTC-based, TZ-safe). */
function dayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Day of week for a day index. 0=Sunday … 6=Saturday. */
function dowOf(idx: number): number {
  return new Date(idx * 86_400_000).getUTCDay();
}

/** Monday-anchored week key (the day index of that week's Monday). */
function weekKey(idx: number): number {
  const dow = dowOf(idx);
  const offsetToMonday = (dow + 6) % 7; // Mon→0, Tue→1 … Sun→6
  return idx - offsetToMonday;
}

/** Today's date in Guayaquil time, as "YYYY-MM-DD". */
export function ecuadorToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
}

export type AchievementId =
  | "first_checkin"
  | "visits_10"
  | "visits_25"
  | "visits_50"
  | "visits_100"
  | "week_streak_4"
  | "perfect_month"
  | "early_bird";

export type Achievement = {
  id: AchievementId;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** 0–1 progress toward unlocking (1 when unlocked). */
  progress: number;
};

export type AttendanceStats = {
  totalVisits: number;
  visitsThisMonth: number;
  visitsThisWeek: number;
  weeklyGoal: number;
  currentStreak: number; // consecutive training days (Sundays don't break it)
  bestStreak: number;
  weekStreak: number; // consecutive weeks hitting the weekly goal
  lastVisit: string | null;
  /** Last 30 days, oldest → newest, for the mini heatmap. */
  last30: { date: string; visited: boolean }[];
  achievements: Achievement[];
};

export type CheckIn = { checked_in_date: string; checked_in_at?: string | null };

/**
 * Compute all retention metrics from a member's check-ins.
 * @param checkIns rows with `checked_in_date` (and optionally `checked_in_at`)
 * @param weeklyGoal target sessions per week (default 4)
 */
export function computeAttendanceStats(
  checkIns: CheckIn[],
  weeklyGoal = 4
): AttendanceStats {
  const todayStr = ecuadorToday();
  const todayIdx = dayIndex(todayStr);

  // Unique sorted day indexes
  const uniqueDates = Array.from(
    new Set(checkIns.map((c) => c.checked_in_date))
  ).sort();
  const indexes = uniqueDates.map(dayIndex);
  const visited = new Set(indexes);

  const totalVisits = uniqueDates.length;
  const lastVisit = uniqueDates.length ? uniqueDates[uniqueDates.length - 1] : null;

  // ── This month / this week ──────────────────────────────────────────────
  const monthPrefix = todayStr.slice(0, 7); // "YYYY-MM"
  const visitsThisMonth = uniqueDates.filter((d) => d.startsWith(monthPrefix)).length;
  const currentWeek = weekKey(todayIdx);
  const visitsThisWeek = indexes.filter((i) => weekKey(i) === currentWeek).length;

  // ── Current streak (walk backwards, Sunday = grace) ─────────────────────
  let currentStreak = 0;
  {
    let cursor = todayIdx;
    // Today still pending (not trained yet, gym open) shouldn't break the streak
    if (!visited.has(cursor) && dowOf(cursor) !== GYM_CLOSED_DOW) cursor--;
    while (true) {
      if (visited.has(cursor)) {
        currentStreak++;
        cursor--;
      } else if (dowOf(cursor) === GYM_CLOSED_DOW) {
        cursor--; // Sunday grace
      } else {
        break;
      }
    }
  }

  // ── Best streak ever ────────────────────────────────────────────────────
  let bestStreak = 0;
  {
    let run = 0;
    let prev: number | null = null;
    for (const idx of indexes) {
      if (prev === null || gapIsOnlySundays(prev, idx)) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > bestStreak) bestStreak = run;
      prev = idx;
    }
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  // ── Week streak (consecutive weeks hitting goal) ────────────────────────
  const perWeek = new Map<number, number>();
  for (const i of indexes) perWeek.set(weekKey(i), (perWeek.get(weekKey(i)) ?? 0) + 1);
  let weekStreak = 0;
  {
    let wk = currentWeek;
    while (true) {
      const count = perWeek.get(wk) ?? 0;
      if (count >= weeklyGoal) {
        weekStreak++;
      } else if (wk === currentWeek) {
        // current week still in progress — don't break, don't count
      } else {
        break;
      }
      wk -= 7;
    }
  }

  // ── Last 30 days heatmap ────────────────────────────────────────────────
  const last30: { date: string; visited: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const idx = todayIdx - i;
    const dt = new Date(idx * 86_400_000).toISOString().slice(0, 10);
    last30.push({ date: dt, visited: visited.has(idx) });
  }

  // ── Early bird: any check-in before 7am ─────────────────────────────────
  const earlyBird = checkIns.some((c) => {
    if (!c.checked_in_at) return false;
    const hour = new Date(c.checked_in_at).getHours();
    return hour < 7;
  });

  const achievements = buildAchievements({
    totalVisits,
    weekStreak,
    visitsThisMonth,
    earlyBird,
  });

  return {
    totalVisits,
    visitsThisMonth,
    visitsThisWeek,
    weeklyGoal,
    currentStreak,
    bestStreak,
    weekStreak,
    lastVisit,
    last30,
    achievements,
  };
}

/** True when every day strictly between a and b is a Sunday (gym closed). */
function gapIsOnlySundays(a: number, b: number): boolean {
  if (b - a === 1) return true;
  for (let i = a + 1; i < b; i++) {
    if (dowOf(i) !== GYM_CLOSED_DOW) return false;
  }
  return true;
}

function buildAchievements(d: {
  totalVisits: number;
  weekStreak: number;
  visitsThisMonth: number;
  earlyBird: boolean;
}): Achievement[] {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  return [
    {
      id: "first_checkin",
      emoji: "🎯",
      title: "Primer paso",
      description: "Tu primer check-in",
      unlocked: d.totalVisits >= 1,
      progress: clamp(d.totalVisits / 1),
    },
    {
      id: "visits_10",
      emoji: "💪",
      title: "Constancia",
      description: "10 visitas",
      unlocked: d.totalVisits >= 10,
      progress: clamp(d.totalVisits / 10),
    },
    {
      id: "visits_25",
      emoji: "⚡",
      title: "En racha",
      description: "25 visitas",
      unlocked: d.totalVisits >= 25,
      progress: clamp(d.totalVisits / 25),
    },
    {
      id: "visits_50",
      emoji: "🏆",
      title: "Imparable",
      description: "50 visitas",
      unlocked: d.totalVisits >= 50,
      progress: clamp(d.totalVisits / 50),
    },
    {
      id: "visits_100",
      emoji: "👑",
      title: "Leyenda Iron",
      description: "100 visitas",
      unlocked: d.totalVisits >= 100,
      progress: clamp(d.totalVisits / 100),
    },
    {
      id: "week_streak_4",
      emoji: "🔥",
      title: "Mes de fuego",
      description: "4 semanas seguidas en meta",
      unlocked: d.weekStreak >= 4,
      progress: clamp(d.weekStreak / 4),
    },
    {
      id: "perfect_month",
      emoji: "📅",
      title: "Mes completo",
      description: "12+ visitas en el mes",
      unlocked: d.visitsThisMonth >= 12,
      progress: clamp(d.visitsThisMonth / 12),
    },
    {
      id: "early_bird",
      emoji: "🌅",
      title: "Madrugador",
      description: "Entreno antes de las 7am",
      unlocked: d.earlyBird,
      progress: d.earlyBird ? 1 : 0,
    },
  ];
}
