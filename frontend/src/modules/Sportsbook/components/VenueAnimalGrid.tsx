import { memo } from 'react';

import { animalForPlace, AnimalInk } from './placeAnimals';

export interface VenueCardItem {
  readonly id: string;
  readonly title: string;
  /** Ciudad, sede o país reales; también decide el animal. */
  readonly place: string;
  readonly detail?: string;
  readonly dateLabel?: string;
  readonly countLabel: string;
  readonly liveCount: number;
  /** Código de país (ISO-2) para elegir el animal cuando el nombre no basta. */
  readonly hint?: string;
}

interface VenueAnimalGridProps {
  readonly kicker: string;
  readonly title: string;
  /** Parte del título que va en el color de acento. */
  readonly titleAccent: string;
  readonly description: string;
  readonly items: readonly VenueCardItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly emptyMessage: string;
  readonly isLoading: boolean;
  /** Muestra «Ver todas» para limpiar la selección (filtros opcionales). */
  readonly allowClear?: boolean;
}

/** Acentos del diseño «Hermes ink», rotados por tarjeta. */
const ACCENTS = ['#D4FF3F', '#F3E5AB', '#FF2A55', '#B07CFF', '#A8B5A2'] as const;
const ACCENT_TEXT: Readonly<Record<string, string>> = { '#FF2A55': '#FF6B88' };

/**
 * Sedes en estilo «Hermes ink». Cada tarjeta nace de una cartelera o liga real
 * de la API; el animal solo ilustra el lugar. Sin cifras ni textos inventados.
 */
function VenueAnimalGrid({
  kicker,
  title,
  titleAccent,
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
      id='sedes'
      aria-labelledby='venue-grid-title'
      className='hx hx-bg flex scroll-mt-20 flex-col gap-8 rounded-sm px-4 pb-10 pt-6 sm:px-6'
    >
      <div className='flex flex-wrap items-end justify-between gap-5 border-t border-[#2C2C2C] pt-5'>
        <div className='flex max-w-2xl flex-col gap-3.5'>
          <span className='hx-mono text-[color:var(--hx-accent)]'>/ {kicker}</span>
          <h2
            id='venue-grid-title'
            className='hx-serif m-0 text-[clamp(34px,4.4vw,52px)] leading-none tracking-[-0.015em] text-[#F3E5AB]'
          >
            {title} <em className='text-[color:var(--hx-accent)]'>{titleAccent}</em>
          </h2>
          <p className='m-0 text-[15px] leading-relaxed text-[#B9B9B9]'>{description}</p>
        </div>
        {allowClear && selectedId && (
          <button type='button' onClick={() => onSelect('all')} className='hx-btn ghost'>
            Ver todas ({items.length})
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className='hx-mono text-[#9C9C9C]'>{isLoading ? 'Cargando…' : emptyMessage}</p>
      ) : (
        <div className='grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4'>
          {items.map((item, index) => {
            const selected = selectedId === item.id;
            const accent = ACCENTS[index % ACCENTS.length];
            const accentText = ACCENT_TEXT[accent] ?? accent;
            const animal = animalForPlace(item.place, item.hint);

            return (
              <button
                key={item.id}
                type='button'
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className='hx-card cursor-pointer p-0'
                style={{
                  ['--hx-accent' as string]: accent,
                  borderColor: selected ? accent : undefined,
                }}
              >
                <div className='hx-art h-[200px] w-full' style={{ ['--ac' as string]: accent }}>
                  <AnimalInk animal={animal} />
                </div>

                <div className='flex flex-1 flex-col gap-3.5 border-t border-[#2C2C2C] p-[18px]'>
                  <div className='flex items-center justify-between gap-2'>
                    <span
                      className='hx-mono px-[9px] py-1 font-bold'
                      style={
                        selected
                          ? { background: accent, color: '#0D0D0D' }
                          : { border: `1px solid ${accent}`, color: accentText }
                      }
                    >
                      {item.dateLabel ?? animal.label}
                    </span>
                    {item.liveCount > 0 ? (
                      <span className='hx-mono inline-flex items-center gap-1.5 text-[10px] text-[color:var(--hx-accent)]'>
                        <span className='h-1.5 w-1.5 rounded-full bg-[color:var(--hx-accent)] motion-safe:animate-pulse' />
                        {item.liveCount} en vivo
                      </span>
                    ) : (
                      <span className='hx-mono text-[10px] text-[#9C9C9C]'>{item.place}</span>
                    )}
                  </div>

                  <span className='hx-serif text-[30px] leading-[1.02] text-[#F3E5AB]'>{item.title}</span>

                  {item.detail && (
                    <span className='text-[13.5px] leading-snug text-[#B9B9B9]'>{item.detail}</span>
                  )}

                  <span className='hx-mono hx-go mt-auto flex justify-between border-t border-[#2C2C2C] pt-3 text-[10px] text-[#9C9C9C]'>
                    <span>{item.countLabel}</span>
                    <span>{animal.label} ↗</span>
                  </span>
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
