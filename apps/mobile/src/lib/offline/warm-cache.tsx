// Carga al abrir la app los datos de todas las pantallas, aunque el socio no
// las visite, para que queden guardados en el teléfono y se vean sin
// internet. Sin conexión estas consultas solo esperan (no gastan nada).

import { todayInEcuador } from '@ironfit/shared/date';

import { useBody } from '@/features/body/use-body';
import { useClasses } from '@/features/classes/use-classes';
import { useChallenges, useCommunityTerms, useFeed } from '@/features/community/use-community';
import { useHome } from '@/features/home/use-home';
import { useProfile } from '@/features/profile/use-profile';
import { useLiftRecords } from '@/features/records/lifts';
import { useActivities, useLatestWeight } from '@/features/sports/use-activities';
import { useStrength } from '@/features/strength/use-strength';
import { useActiveMembership } from '@/features/training/use-active';
import { useDayWod } from '@/features/wod/use-day-wod';
import { useMyResult, useWodHistory } from '@/features/wod/use-wod';
import { useAuth } from '@/lib/auth';

export function WarmCache() {
  const { member, session } = useAuth();
  const memberId = member!.id;
  const today = todayInEcuador();
  const active = useActiveMembership(memberId);
  const terms = useCommunityTerms(memberId);
  const community = active.data === true && terms.data === true;

  useHome(memberId);
  useClasses(memberId);
  useDayWod(today);
  useMyResult(memberId, today);
  useWodHistory(memberId);
  useLiftRecords(memberId);
  useBody(memberId, session!.user.id);
  useStrength(memberId);
  useActivities(memberId);
  useLatestWeight(memberId);
  useProfile(memberId);
  useChallenges(community);
  useFeed(community);
  return null;
}
