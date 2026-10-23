import { useEffect, useRef } from 'react';
import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';

import {
  cardCity,
  formatCardDayBadge,
  shortFighterName,
  ufcCardNumber,
  type UfcCard,
} from '@/domain/ufc';

interface CardSelectorProps {
  readonly cards: readonly UfcCard[];
  readonly activeKey: string | null;
  readonly onSelect: (key: string) => void;
}

/**
 * Selector editorial de sábados. En móvil se desplaza horizontalmente dentro
 * de su propio contenedor; en tablet y escritorio muestra las carteleras en
 * rejilla, sin afectar el ancho de la página.
 */
export default function CardSelector({ cards, activeKey, onSelect }: CardSelectorProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const activeCard = activeRef.current;
    if (!scroller || !activeCard || scroller.scrollWidth <= scroller.clientWidth) return;

    const target =
      activeCard.offsetLeft - (scroller.clientWidth - activeCard.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeKey, cards.length]);

  if (cards.length === 0) return null;

  return (
    <section
      aria-labelledby='upcoming-cards-title'
      className='shibuya-glass min-w-0 overflow-hidden p-3 sm:p-4'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <span className='shibuya-kicker text-crimson'>/ Próximas carteleras</span>
          <span className='h-px w-8 bg-gradient-to-r from-crimson/45 to-transparent' aria-hidden='true' />
          <h2
            id='upcoming-cards-title'
            className='font-display text-[11px] font-bold uppercase tracking-wide text-white'
          >
            Sábados UFC
          </h2>
        </div>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {cards.length} fechas · {cards.reduce((sum, card) => sum + card.events.length, 0)} combates
        </span>
      </div>

      <div
        ref={scrollerRef}
        className='no-scrollbar -mx-1 mt-3 flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 xl:grid-cols-4'
      >
        {cards.map((card) => {
          const active = card.key === activeKey;
          const number = ufcCardNumber(card.competition);

          return (
            <button
              key={card.key}
              ref={active ? activeRef : undefined}
              type='button'
              onClick={() => onSelect(card.key)}
              aria-pressed={active}
              aria-label={`Ver ${card.competition}, ${formatCardDayBadge(card.startTime)}`}
              className={`group relative flex min-w-[236px] max-w-[288px] flex-1 snap-start flex-col overflow-hidden border px-3 py-2.5 text-left transition duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson md:min-w-0 md:max-w-none ${
                active
                  ? 'border-crimson/55 bg-crimson/[0.08] shadow-[0_0_0_1px_rgb(239_68_68_/_0.08),0_16px_40px_-34px_rgb(239_68_68_/_0.8)]'
                  : 'border-white/[0.07] bg-white/[0.018] hover:border-white/20 hover:bg-white/[0.035]'
              }`}
            >
              <span
                aria-hidden='true'
                className={`absolute inset-x-0 top-0 h-px ${
                  active
                    ? 'bg-gradient-to-r from-transparent via-crimson to-transparent'
                    : 'bg-gradient-to-r from-transparent via-white/15 to-transparent'
                }`}
              />

              <span className='flex items-center justify-between gap-2'>
                <span className='inline-flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-metallic-titanium'>
                  <CalendarDays size={10} className={active ? 'text-crimson' : 'text-metallic-slate'} aria-hidden='true' />
                  {formatCardDayBadge(card.startTime)}
                </span>
                <span
                  className={`border px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${
                    active
                      ? 'border-crimson/40 bg-crimson/10 text-crimson'
                      : 'border-white/[0.07] bg-white/[0.02] text-metallic-slate'
                  }`}
                >
                  {number ? `UFC ${number}` : 'FN'}
                </span>
              </span>

              <span className='mt-1.5 line-clamp-1 font-display text-[12px] font-bold uppercase tracking-tight text-white'>
                {card.competition}
              </span>
              <span className='mt-0.5 line-clamp-1 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
                {shortFighterName(card.mainEvent.bout.red.name)} vs.{' '}
                {shortFighterName(card.mainEvent.bout.blue.name)}
              </span>

              <span className='mt-2 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2'>
                <span className='inline-flex min-w-0 items-center gap-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                  <MapPin size={9} className='shrink-0' aria-hidden='true' />
                  <span className='truncate'>{cardCity(card.location)}</span>
                </span>
                <span className='inline-flex shrink-0 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-wide text-metallic-titanium'>
                  {card.events.length} combates
                  <ChevronRight
                    size={10}
                    className={active ? 'text-crimson' : 'text-metallic-slate'}
                    aria-hidden='true'
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
