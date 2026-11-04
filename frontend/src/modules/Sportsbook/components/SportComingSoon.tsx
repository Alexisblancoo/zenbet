import { memo } from 'react';
import { CalendarClock } from 'lucide-react';

import type { SportsbookSportDefinition } from '@/domain/sportsbook';
import { SPORT_ICONS } from './sportVisuals';
import CyberEmptyState from './CyberEmptyState';

interface SportComingSoonProps {
  readonly sport: SportsbookSportDefinition;
  readonly onBack: () => void;
}

/**
 * Estado de filtro para disciplinas que todavía no tienen carteleras en la
 * API. Mantiene la selección visible bajo la identidad visual Cyber-Grunge de ZenBet
 * y ofrece una salida inmediata a UFC/MMA.
 */
function SportComingSoon({ sport, onBack }: SportComingSoonProps) {
  const Icon = SPORT_ICONS[sport.id] ?? CalendarClock;

  return (
    <div data-sport={sport.id} className='w-full'>
      <CyberEmptyState
        title={`${sport.label} · Próximamente en ZenBet`}
        subtitle={`Estamos integrando mercados y modelos de inferencia para ${sport.label.toLowerCase()}. Aún no hay eventos ni cuotas publicadas para esta disciplina. Puedes continuar operando en la cartelera de UFC/MMA.`}
        sportLabel={sport.label}
        cyrillicBadge='СКОРО // В РАЗРАБОТКЕ'
        telemetryCode={`INTEGRATION: ${sport.id.toUpperCase()}_PIPELINE`}
        actionLabel='Ver UFC / MMA'
        onAction={onBack}
        icon={Icon}
      />
    </div>
  );
}

export default memo(SportComingSoon);
