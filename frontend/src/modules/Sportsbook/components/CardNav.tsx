import { displaySourceName, formatSnapshotAt } from '@/domain/ufc';

export type CardSectionKey = 'all' | 'main' | 'prelims' | 'early_prelims';

export interface CardNavSection {
  readonly key: Exclude<CardSectionKey, 'all'>;
  readonly label: string;
  readonly shortLabel: string;
  readonly count: number;
}

interface CardNavProps {
  readonly eventName: string;
  readonly dateLabel: string;
  readonly marketCount: number;
  readonly sections: readonly CardNavSection[];
  readonly activeSection: CardSectionKey;
  readonly observedAt: string | null;
  readonly sourceName?: string | null;
  readonly onSectionChange: (section: CardSectionKey) => void;
}

/**
 * Subnavegación de la cartelera inspirada en las casas de apuestas densas:
 * una sola fila sticky, secciones siempre alcanzables y sin menús escondidos.
 */
export default function CardNav({
  eventName,
  dateLabel,
  marketCount,
  sections,
  activeSection,
  observedAt,
  sourceName,
  onSectionChange,
}: CardNavProps) {
  const snapshot = formatSnapshotAt(observedAt);
  const total = sections.reduce((sum, section) => sum + section.count, 0);

  return (
    <div className='sticky top-16 z-30 border-y border-white/[0.08] bg-[#0A0A0A]/95 backdrop-blur-xl'>
      <div className='mx-auto flex w-full max-w-[1600px] items-stretch gap-2 px-2 sm:px-4 lg:px-6'>
        <div className='hidden shrink-0 flex-col justify-center py-2 pr-4 xl:flex'>
          <span className='font-mono text-[9px] font-bold uppercase tracking-wide text-crimson'>
            {eventName}
          </span>
          <span className='mt-0.5 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
            {dateLabel}
          </span>
        </div>

        <nav
          aria-label='Filtrar cartelera por sección'
          className='no-scrollbar flex min-w-0 flex-1 items-stretch overflow-x-auto'
        >
          <button
            type='button'
            aria-pressed={activeSection === 'all'}
            onClick={() => onSectionChange('all')}
            className={`relative flex shrink-0 items-center gap-1 px-2 py-2.5 font-display text-[9px] font-bold uppercase tracking-wide transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400/70 sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-wide ${
              activeSection === 'all'
                ? 'bg-lime-400 text-[#0D0D0D]'
                : 'text-metallic-slate hover:bg-white/[0.025] hover:text-metallic-chrome'
            }`}
          >
            <span className='h-1 w-1 bg-current' aria-hidden='true' />
            Todos
            <span
              className={`font-mono text-[8px] tabular-nums hidden sm:inline ${
                activeSection === 'all' ? 'text-[#0D0D0D]/60' : 'text-metallic-slate'
              }`}
            >
              {total}
            </span>
          </button>

          {sections.map((section) => {
            const active = activeSection === section.key;

            return (
              <button
                key={section.key}
                type='button'
                aria-pressed={active}
                onClick={() => onSectionChange(section.key)}
                className={`relative flex shrink-0 items-center gap-1 px-2 py-2.5 font-display text-[9px] font-bold uppercase tracking-wide transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lime-400/70 sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-wide ${
                  active
                    ? 'bg-lime-400 text-[#0D0D0D]'
                    : 'text-metallic-slate hover:bg-white/[0.025] hover:text-metallic-chrome'
                }`}
              >
                {active && (
                  <span
                    aria-hidden='true'
                    className='absolute inset-x-2 bottom-0 h-px bg-current sm:inset-x-3'
                  />
                )}
                <span>{section.shortLabel}</span>
                <span
                  className={`hidden font-mono text-[8px] tabular-nums sm:inline ${
                    active ? 'text-[#0D0D0D]/60' : 'text-metallic-slate'
                  }`}
                >
                  {section.count}
                </span>
              </button>
            );
          })}
        </nav>

        <div className='hidden shrink-0 items-center gap-3 border-l border-white/[0.06] pl-4 sm:flex'>
          <span className='font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-titanium'>
            {marketCount} mercados
          </span>
          <span className='h-3 w-px bg-white/10' aria-hidden='true' />
          <span className='font-mono text-[9px] uppercase tracking-wide text-sage'>
            {snapshot ? `${displaySourceName(sourceName) || 'Fuente'} · ${snapshot}` : displaySourceName(sourceName) || 'Sin marca de tiempo'}
          </span>
        </div>
      </div>
    </div>
  );
}
