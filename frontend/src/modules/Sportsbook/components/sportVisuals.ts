import {
  Activity,
  CircleDot,
  Gamepad2,
  Goal,
  HandFist,
  Swords,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import type { SportsbookSportId } from '@/domain/sportsbook';

/** Icono editorial por disciplina; compartido por la grilla y el estado vacío. */
export const SPORT_ICONS: Readonly<Record<SportsbookSportId, LucideIcon>> = {
  mma: Swords,
  soccer: Goal,
  basketball: Activity,
  boxing: HandFist,
  esports: Gamepad2,
  tennis: Trophy,
  baseball: CircleDot,
};
