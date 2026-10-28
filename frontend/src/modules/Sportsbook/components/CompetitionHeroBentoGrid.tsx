import { memo, useMemo } from 'react';
import { ArrowUpRight, Flame, Radio, Shield, Trophy, Zap } from 'lucide-react';

export type SportsCompetitionCategory = 'football' | 'mma';

export interface CompetitionItem {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly tag: string;
  readonly category: SportsCompetitionCategory;
  readonly region: string;
  readonly logoUrl?: string;
  readonly bgImage: string;
  readonly accentColor: string;
  readonly liveCount?: number;
  readonly eventCount: number;
  readonly description: string;
  readonly cyrillicTag: string;
}

export const FOOTBALL_COMPETITIONS: readonly CompetitionItem[] = [
  {
    id: 'ucl',
    name: 'UEFA Champions League',
    shortName: 'UCL',
    tag: 'EUROPE · ELITE',
    category: 'football',
    region: 'Europa',
    bgImage:
      'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
    accentColor: '#D4FF3F',
    eventCount: 0,
    liveCount: 0,
    description: 'La máxima competición de clubes. Cuotas en vivo para fase decisiva.',
    cyrillicTag: 'ЛИГА ЧЕМПИОНОВ',
  },
  {
    id: 'premier',
    name: 'Premier League',
    shortName: 'Premier',
    tag: 'ENGLAND · TIER 1',
    category: 'football',
    region: 'Inglaterra',
    bgImage:
      'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=80',
    accentColor: '#A855F7',
    eventCount: 0,
    liveCount: 0,
    description: 'El fútbol más rápido del planeta. Mercados de goles y 1X2.',
    cyrillicTag: 'АПЛ АНГЛИЯ',
  },
  {
    id: 'laliga',
    name: 'LaLiga EA Sports',
    shortName: 'LaLiga',
    tag: 'SPAIN · PRIMERA',
    category: 'football',
    region: 'España',
    bgImage:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
    accentColor: '#EF4444',
    eventCount: 0,
    liveCount: 0,
    description: 'Clásicos españoles y choque por la corona europea.',
    cyrillicTag: 'ЛА ЛИГА',
  },
  {
    id: 'bolivia',
    name: 'División Profesional',
    shortName: 'Liga Tigo',
    tag: 'BOLIVIA · CLAUSURA',
    category: 'football',
    region: 'Bolivia',
    bgImage:
      'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=80',
    accentColor: '#10B981',
    eventCount: 0,
    liveCount: 0,
    description: 'Clásico Paceño en el Hernando Siles y choque del Valle.',
    cyrillicTag: 'БОЛИВИЯ',
  },
];

export const MMA_PROMOTIONS: readonly CompetitionItem[] = [
  {
    id: 'promotion_ufc',
    name: 'Ultimate Fighting Championship',
    shortName: 'UFC',
    tag: 'LAS VEGAS · PPV',
    category: 'mma',
    region: 'Global',
    bgImage:
      'https://images.unsplash.com/photo-1517438322307-e67111335449?auto=format&fit=crop&w=800&q=80',
    accentColor: '#EF4444',
    eventCount: 0,
    liveCount: 0,
    description: 'Cartelera estelar, peleas de título mundial y preliminares.',
    cyrillicTag: 'ЮФС · UFC',
  },
  {
    id: 'promotion_oktagon',
    name: 'OKTAGON MMA',
    shortName: 'OKTAGON',
    tag: 'EUROPE · STADIUM',
    category: 'mma',
    region: 'Europa',
    bgImage:
      'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?auto=format&fit=crop&w=800&q=80',
    accentColor: '#F59E0B',
    eventCount: 0,
    liveCount: 0,
    description: 'La promotora más grande de Europa. Récord de 60.000 fans en Frankfurt.',
    cyrillicTag: 'ОКТАГОН ММА',
  },
  {
    id: 'promotion_one',
    name: 'ONE Championship',
    shortName: 'ONE FC',
    tag: 'ASIA · STRIKING',
    category: 'mma',
    region: 'Asia',
    bgImage:
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
    accentColor: '#EAB308',
    eventCount: 0,
    liveCount: 0,
    description: 'Artes marciales mixtas, Muay Thai con guantes de 4oz y Kickboxing.',
    cyrillicTag: 'ВАН ЧЕМПИОНШИП',
  },
  {
    id: 'promotion_pfl',
    name: 'PFL World Tournament',
    shortName: 'PFL',
    tag: 'USA · SMARTCAGE',
    category: 'mma',
    region: 'Estados Unidos',
    bgImage:
      'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=800&q=80',
    accentColor: '#3B82F6',
    eventCount: 0,
    liveCount: 0,
    description: 'Temporada regular, playoffs del millón de dólares y Super Fights.',
    cyrillicTag: 'ПФЛ ММА',
  },
];

export interface CompetitionHeroBentoGridProps {
  readonly activeCategory: SportsCompetitionCategory;
  readonly selectedCompetitionId: string | null;
  readonly onSelectCompetition: (id: string) => void;
  readonly countsById?: Readonly<Record<string, { eventCount: number; liveCount: number }>>;
  readonly className?: string;
}

function CompetitionHeroBentoGrid({
  activeCategory,
  selectedCompetitionId,
  onSelectCompetition,
  countsById,
  className = '',
}: CompetitionHeroBentoGridProps) {
  const items = activeCategory === 'football' ? FOOTBALL_COMPETITIONS : MMA_PROMOTIONS;

  return (
    <section
      aria-labelledby='competitions-hero-title'
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A] p-3.5 sm:p-5 ${className}`}
    >
      {/* Cabecera Brutalista de Competiciones */}
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] pb-3.5'>
        <div>
          <div className='flex items-center gap-2'>
            <span className='font-mono text-[9px] font-bold uppercase tracking-widest text-[#D4FF3F]'>
              / {activeCategory === 'football' ? 'LIGAS & COPAS DE ÉLITE' : 'PROMOTORAS GLOBALES DE MMA'}
            </span>
            <span className='text-[8px] font-mono text-metallic-slate/40'>
              {activeCategory === 'football' ? 'ЛИГИ МИРА' : 'МИРОВЫЕ ПРОМОУШЕНЫ'}
            </span>
          </div>
          <h2
            id='competitions-hero-title'
            className='mt-1 font-display text-base font-bold uppercase tracking-tight text-white sm:text-lg'
          >
            {activeCategory === 'football'
              ? 'Competiciones Destacadas de Fútbol'
              : 'Promotoras Oficiales de Combate'}
          </h2>
          <p className='mt-0.5 max-w-xl text-[11px] leading-relaxed text-metallic-slate'>
            {activeCategory === 'football'
              ? 'Navega directamente entre Champions League, Premier, LaLiga y División Boliviana sin perder el contexto.'
              : 'Acceso directo a carteleras completas de UFC, OKTAGON, ONE Championship y PFL.'}
          </p>
        </div>

        {/* Botón de ver todas */}
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => onSelectCompetition('all')}
            className={`border px-3 py-1 font-mono text-[9px] uppercase tracking-wider transition-all duration-150 ${
              selectedCompetitionId === 'all' || !selectedCompetitionId
                ? 'border-[#D4FF3F] bg-[#D4FF3F]/[0.12] font-bold text-[#D4FF3F] shadow-[0_0_12px_-4px_rgba(212,255,63,0.5)]'
                : 'border-white/[0.08] bg-white/[0.02] text-metallic-slate hover:border-white/20 hover:text-white'
            }`}
          >
            Ver Todas ({items.reduce((s, i) => s + (countsById?.[i.id]?.eventCount ?? i.eventCount), 0)})
          </button>
        </div>
      </div>

      {/* Grid Bento Visual con Imágenes Grandes */}
      <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        {items.map((item, index) => {
          const isSelected = selectedCompetitionId === item.id;
          const isLead = index === 0;
          const dynamicCounts = countsById?.[item.id];
          const eventCount = dynamicCounts !== undefined ? dynamicCounts.eventCount : item.eventCount;
          const liveCount = dynamicCounts !== undefined ? dynamicCounts.liveCount : item.liveCount;

          return (
            <button
              key={item.id}
              type='button'
              onClick={() => onSelectCompetition(item.id)}
              aria-pressed={isSelected}
              className={`group relative flex min-h-[160px] sm:min-h-[175px] flex-col justify-between overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF3F] ${
                isSelected
                  ? 'border-[#D4FF3F] bg-[#111111] shadow-[0_0_24px_-6px_rgba(212,255,63,0.4)] z-10 scale-[1.01]'
                  : 'border-white/[0.09] bg-[#0E0E0E] hover:border-white/25 hover:shadow-[0_8px_30px_rgba(0,0,0,0.85)]'
              }`}
            >
              {/* Imagen de fondo de alto impacto */}
              <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 overflow-hidden'
              >
                <img
                  src={item.bgImage}
                  alt=''
                  loading='lazy'
                  decoding='async'
                  className={`h-full w-full object-cover object-center saturate-[0.6] transition-all duration-500 ease-out group-hover:scale-105 group-hover:saturate-[0.9] ${
                    isSelected ? 'opacity-35 scale-105 saturate-[0.9]' : 'opacity-20'
                  }`}
                />
                {/* Degradados cinemáticos para legibilidad superior */}
                <div className='absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent' />
                <div className='absolute inset-0 bg-gradient-to-r from-[#0A0A0A]/90 via-transparent to-[#0A0A0A]/50' />
              </div>

              {/* Fila superior: Tag de región + Badge de estado en vivo */}
              <div className='relative z-10 flex items-start justify-between gap-2'>
                <div className='flex items-center gap-1.5'>
                  <span className='grid h-6 px-2 place-items-center rounded border border-white/15 bg-black/60 font-mono text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur-md'>
                    {item.shortName}
                  </span>
                  <span className='font-mono text-[8px] uppercase tracking-wider text-white/50'>
                    {item.tag}
                  </span>
                </div>

                {liveCount && liveCount > 0 ? (
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-[#D4FF3F]/40 bg-[#D4FF3F]/15 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-[#D4FF3F] backdrop-blur-md'>
                    <span className='h-1.5 w-1.5 rounded-full bg-[#D4FF3F] motion-safe:animate-pulse' />
                    {liveCount} LIVE
                  </span>
                ) : (
                  <span className='font-mono text-[7px] font-bold tracking-widest uppercase text-white/30'>
                    {item.cyrillicTag}
                  </span>
                )}
              </div>

              {/* Fila inferior: Nombre imponente, descripción y cuotas */}
              <div className='relative z-10 mt-6'>
                <div className='flex items-center justify-between gap-2'>
                  <h3
                    className={`font-display text-[15px] sm:text-base font-black uppercase leading-tight tracking-tight transition-colors duration-200 ${
                      isSelected ? 'text-[#D4FF3F]' : 'text-white group-hover:text-[#D4FF3F]'
                    }`}
                  >
                    {item.name}
                  </h3>
                  <ArrowUpRight
                    size={15}
                    className={`shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
                      isSelected ? 'text-[#D4FF3F]' : 'text-white/40 group-hover:text-[#D4FF3F]'
                    }`}
                    aria-hidden='true'
                  />
                </div>

                <p className='mt-1 line-clamp-2 text-[10px] leading-relaxed text-neutral-400'>
                  {item.description}
                </p>

                <div className='mt-2.5 flex items-center justify-between border-t border-white/[0.08] pt-2 font-mono text-[8px] uppercase tracking-wider'>
                  <span className='text-metallic-slate'>
                    {eventCount > 0 ? `${eventCount} ${activeCategory === 'football' ? 'Partidos' : 'Combates'} en API` : 'Próxima cartelera'}
                  </span>
                  <span
                    className={
                      isSelected ? 'font-bold text-[#D4FF3F]' : 'text-metallic-slate/70'
                    }
                  >
                    {isSelected ? '✓ SELECCIONADA' : 'EXPLORAR'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(CompetitionHeroBentoGrid);

