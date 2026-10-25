import { formatSnapshotAt } from '@/domain/ufc';

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
    <div className='sticky top-16 z-30 border-y border-white/[0.08] bg-[#07090E]/95 backdrop-blur-xl'>
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
            className={`relative flex shrink-0 items-center gap-1 px-2 py-2.5 font-display text-[9px] font-bold uppercase tracking-wide transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-wide ${
              activeSection === 'all'
                ? 'bg-linear-to-b from-crimson/[0.08] to-transparent text-white'
                : 'text-metallic-slate hover:bg-white/[0.025] hover:text-metallic-chrome'
            }`}
          >
            {activeSection === 'all' && (
              <span
                aria-hidden='true'
                className='absolute inset-x-2 bottom-0 h-px bg-linear-to-r from-transparent via-crimson to-transparent sm:inset-x-3'
              />
            )}
            <span className='h-1 w-1 bg-crimson' aria-hidden='true' />
            Todos
            <span className='font-mono text-[8px] tabular-nums text-metallic-slate hidden sm:inline'>{total}</span>
          </button>

          {sections.map((section) => {
            const active = activeSection === section.key;

            return (
              <button
                key={section.key}
                type='button'
                aria-pressed={active}
                onClick={() => onSectionChange(section.key)}
                className={`relative flex shrink-0 items-center gap-1 px-2 py-2.5 font-display text-[9px] font-bold uppercase tracking-wide transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric sm:gap-1.5 sm:px-3 sm:text-[10px] sm:tracking-wide ${
                  active
                    ? 'bg-linear-to-b from-crimson/[0.08] to-transparent text-white'
                    : 'text-metallic-slate hover:bg-white/[0.025] hover:text-metallic-chrome'
                }`}
              >
                {active && (
                  <span
                    aria-hidden='true'
                    className='absolute inset-x-2 bottom-0 h-px bg-linear-to-r from-transparent via-crimson to-transparent sm:inset-x-3'
                  />
                )}
                <span>{section.shortLabel}</span>
                <span className='hidden font-mono text-[8px] tabular-nums text-metallic-slate sm:inline'>
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
          <span className='font-mono text-[9px] uppercase tracking-wide text-electric-soft'>
            {snapshot ? `${sourceName ?? 'Snapshot'} · ${snapshot}` : sourceName ?? 'Snapshot local'}
          </span>
        </div>
      </div>
    </div>
  );
}
