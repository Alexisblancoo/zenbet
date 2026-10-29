import { memo, useState } from 'react';

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
  /** Sede (arena o estadio) y fecha reales; activan el botón con la descripción. */
  readonly venue?: string;
  readonly whenLabel?: string;
  /** Peleadores de la pelea estelar (nombre e imagen reales de la API). */
  readonly versus?: {
    readonly left: VersusSide;
    readonly right: VersusSide;
  };
}

export interface VersusSide {
  readonly name: string;
  readonly imageUrl: string | null;
}

function FighterPhoto({ side }: { readonly side: VersusSide }) {
  return (
    <div className='hx-photo relative min-w-0 flex-1'>
      {side.imageUrl ? (
        <img src={side.imageUrl} alt={side.name} loading='lazy' decoding='async' />
      ) : (
        <span className='hx-serif absolute inset-0 grid place-items-center px-2 text-center text-[18px] leading-tight text-[color:var(--ac)]'>
          {side.name}
        </span>
      )}
      <span className='hx-mono absolute bottom-2 left-2 right-2 z-[3] truncate bg-[#0B0B0A]/90 px-1.5 py-1 text-center text-[10px] font-bold text-[#F3E5AB]'>
        {side.name}
      </span>
    </div>
  );
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
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

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
            className='hx-serif m-0 text-[clamp(26px,3.4vw,40px)] leading-[1.08] tracking-tight text-[#F3E5AB]'
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
            const infoOpen = openInfoId === item.id;
            const infoId = `venue-info-${item.id}`;
            const hasVersus = Boolean(item.versus);

            return (
              <article
                key={item.id}
                className='hx-card'
                style={{
                  ['--hx-accent' as string]: accent,
                  borderColor: selected ? accent : undefined,
                }}
              >
                <button
                  type='button'
                  onClick={() => onSelect(item.id)}
                  aria-pressed={selected}
                  className='flex w-full cursor-pointer flex-col p-0 text-left'
                >
                  <div
                    className={`hx-art w-full ${hasVersus ? 'photo flex h-[220px]' : 'h-[200px]'}`}
                    style={{ ['--ac' as string]: accent }}
                  >
                    {item.versus ? (
                      <>
                        <FighterPhoto side={item.versus.left} />
                        <span
                          className='hx-serif absolute left-1/2 top-1/2 z-[3] -translate-x-1/2 -translate-y-1/2 border bg-[#0B0B0A] px-2.5 pb-1 pt-0.5 text-[16px] leading-none'
                          style={{ color: accent, borderColor: accent }}
                          aria-label='contra'
                        >
                          vs
                        </span>
                        <FighterPhoto side={item.versus.right} />
                      </>
                    ) : (
                      <AnimalInk animal={animal} />
                    )}
                  </div>

                  <div className='flex flex-col gap-3.5 border-t border-[#2C2C2C] px-[18px] pt-[18px]'>
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
                      {item.liveCount > 0 && (
                        <span className='hx-mono inline-flex items-center gap-1.5 text-[10px] text-[color:var(--hx-accent)]'>
                          <span className='h-1.5 w-1.5 rounded-full bg-[color:var(--hx-accent)] motion-safe:animate-pulse' />
                          {item.liveCount} en vivo
                        </span>
                      )}
                    </div>

                    <div className='flex items-start justify-between gap-3'>
                      <div className='flex min-w-0 flex-col gap-2'>
                        <span className='hx-mono text-[10px] text-[#9C9C9C]'>{item.place}</span>
                        <span className='hx-serif text-[21px] leading-[1.12] text-[#F3E5AB]'>{item.title}</span>
                        {item.detail && (
                          <span className='text-[13.5px] leading-snug text-[#B9B9B9]'>{item.detail}</span>
                        )}
                      </div>
                      {hasVersus && (
                        <div
                          className='hx-art h-[88px] w-[88px] shrink-0 border border-[#2C2C2C]'
                          style={{ ['--ac' as string]: accent }}
                          role='img'
                          aria-label={`${animal.label}, representa a ${animal.represents}`}
                          title={`${animal.label} · ${animal.represents}`}
                        >
                          <AnimalInk animal={animal} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                <div className='mt-auto flex flex-col gap-3 px-[18px] pb-[18px] pt-3.5'>
                  <div className='hx-mono hx-go flex items-center justify-between gap-3 border-t border-[#2C2C2C] pt-3 text-[10px] text-[#9C9C9C]'>
                    <span>{item.countLabel}</span>
                    {item.venue ? (
                      <button
                        type='button'
                        onClick={() => setOpenInfoId(infoOpen ? null : item.id)}
                        aria-expanded={infoOpen}
                        aria-controls={infoId}
                        className='hx-mono cursor-pointer text-right text-[10px] text-[#D8D8D8] underline-offset-4 hover:text-[color:var(--hx-accent)] hover:underline focus-visible:outline-none focus-visible:text-[color:var(--hx-accent)] focus-visible:underline'
                      >
                        {item.venue} {infoOpen ? '↑' : '↗'}
                      </button>
                    ) : (
                      <span>{animal.label} ↗</span>
                    )}
                  </div>

                  {infoOpen && item.venue && (
                    <div
                      id={infoId}
                      className='flex flex-col gap-2 border border-[#2C2C2C] bg-[#0B0B0A] p-3.5'
                    >
                      <span className='hx-mono text-[10px] text-[color:var(--hx-accent)]'>Sobre la sede</span>
                      <span className='hx-serif text-[18px] leading-tight text-[#F3E5AB]'>{item.venue}</span>
                      <dl className='m-0 flex flex-col gap-1 text-[13px] leading-snug text-[#B9B9B9]'>
                        <div><dt className='inline text-[#9C9C9C]'>Ciudad: </dt><dd className='inline'>{item.place}</dd></div>
                        {item.whenLabel && (
                          <div><dt className='inline text-[#9C9C9C]'>Inicio: </dt><dd className='inline'>{item.whenLabel}</dd></div>
                        )}
                        <div><dt className='inline text-[#9C9C9C]'>Cartelera: </dt><dd className='inline'>{item.countLabel}</dd></div>
                        <div>
                          <dt className='inline text-[#9C9C9C]'>Animal de la sede: </dt>
                          <dd className='inline'>{animal.label}, representa a {animal.represents}.</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(VenueAnimalGrid);
