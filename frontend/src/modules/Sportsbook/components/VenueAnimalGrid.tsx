import { memo } from 'react';
import { ArrowUpRight } from 'lucide-react';

import { animalForPlace } from './placeAnimals';

export interface VenueCardItem {
  readonly id: string;
  readonly title: string;
  /** Ciudad, sede o país reales; también decide el animal. */
  readonly place: string;
  readonly detail?: string;
  readonly dateLabel?: string;
  readonly countLabel: string;
  readonly liveCount: number;
  /** Texto extra que decide el animal (código de país, estadio…). */
  readonly hint?: string;
}

interface VenueAnimalGridProps {
  readonly kicker: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly VenueCardItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly emptyMessage: string;
  readonly isLoading: boolean;
  /** Muestra «Ver todas» para limpiar la selección (filtros opcionales). */
  readonly allowClear?: boolean;
}

/**
 * Rejilla de sedes. Cada tarjeta nace de un evento o una liga reales de la API;
 * el animal es solo la ilustración del lugar. Sin cifras ni textos inventados.
 */
function VenueAnimalGrid({
  kicker,
  title,
  description,
  items,
  selectedId,
  onSelect,
  emptyMessage,
  isLoading,
  allowClear = false,
}: VenueAnimalGridProps) {
  return (
    <section
      aria-labelledby='venue-grid-title'
      className='relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-3.5 sm:p-5'
    >
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3.5'>
        <div>
          <span className='font-mono text-[10px] font-bold uppercase tracking-widest text-lime-400'>
            / {kicker}
          </span>
          <h2
            id='venue-grid-title'
            className='mt-1 font-serif text-xl font-bold uppercase tracking-tight text-cream sm:text-2xl'
          >
            {title}
          </h2>
          <p className='mt-0.5 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
            {description}
          </p>
        </div>
        {allowClear && selectedId && (
          <button type='button' onClick={() => onSelect('all')} className='btn btn-secondary btn-sm'>
            Ver todas ({items.length})
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className='mt-4 text-xs text-metallic-titanium'>
          {isLoading ? 'Cargando…' : emptyMessage}
        </p>
      ) : (
        <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {items.map((item) => {
            const selected = selectedId === item.id;
            const animal = animalForPlace(item.place, item.hint);
            const { Icon } = animal;

            return (
              <button
                key={item.id}
                type='button'
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={`group relative flex min-h-[236px] flex-col justify-between overflow-hidden rounded-xl border p-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 ${
                  selected
                    ? 'border-lime-400 bg-[#111111]'
                    : 'border-white/[0.09] bg-[#0E0E0E] hover:border-white/25'
                }`}
              >
                {/* Tramado de puntos + animal de la sede, en el mismo lima del sitio */}
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(#D4FF3F_1px,transparent_1.3px)] [background-size:7px_7px] [mask-image:linear-gradient(to_bottom_right,black,transparent_70%)]'
                />
                <Icon
                  aria-hidden='true'
                  className={`pointer-events-none absolute -right-2 -top-1 h-28 w-28 transition-opacity duration-300 ${
                    selected ? 'text-lime-400 opacity-90' : 'text-lime-400 opacity-45 group-hover:opacity-80'
                  }`}
                />

                <div className='relative flex items-start justify-between gap-2'>
                  {item.liveCount > 0 ? (
                    <span className='inline-flex items-center gap-1.5 rounded-full border border-lime-400/40 bg-lime-400/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-lime-400'>
                      <span className='h-1.5 w-1.5 rounded-full bg-lime-400 motion-safe:animate-pulse' />
                      {item.liveCount} en vivo
                    </span>
                  ) : (
                    <span />
                  )}
                </div>

                <div className='relative mt-24'>
                  <p className='font-mono text-[9px] uppercase tracking-wider text-metallic-titanium'>
                    {item.place}
                  </p>
                  <div className='mt-1 flex items-start justify-between gap-2'>
                    <h3
                      className={`font-serif text-lg font-bold uppercase leading-tight ${
                        selected ? 'text-lime-400' : 'text-cream group-hover:text-lime-400'
                      }`}
                    >
                      {item.title}
                    </h3>
                    <ArrowUpRight size={15} className='mt-1 shrink-0 text-metallic-titanium' aria-hidden='true' />
                  </div>
                  {item.detail && (
                    <p className='mt-1 line-clamp-1 text-[11px] text-metallic-titanium'>{item.detail}</p>
                  )}
                  <div className='mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.08] pt-2 font-mono text-[9px] uppercase tracking-wider text-metallic-titanium'>
                    <span>{item.dateLabel ? `${item.dateLabel} · ` : ''}{item.countLabel}</span>
                    <span className='shrink-0 text-lime-400/80'>{animal.label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(VenueAnimalGrid);
