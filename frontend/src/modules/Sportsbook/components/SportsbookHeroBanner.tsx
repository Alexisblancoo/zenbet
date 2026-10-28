import { memo } from 'react';
import { Activity, Gauge, Radio, ShieldCheck, Zap } from 'lucide-react';

interface SportsbookHeroBannerProps {
  readonly activeSport?: string;
  readonly liveCount?: number;
  readonly totalEvents?: number;
}

/**
 * Cabecera oficial Neo-Brutalista de ZenBet Sportsbook.
 * Slogan de alta densidad con acentos Shibuya Lime (#D4FF3F).
 */
function SportsbookHeroBanner({
  activeSport = 'mma',
  liveCount = 0,
  totalEvents = 0,
}: SportsbookHeroBannerProps) {
  return (
    <header className='relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0A0A0A] p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)]'>
      {/* Rayas de acento brutalista Shibuya Lime */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4FF3F] to-transparent shadow-[0_0_12px_#D4FF3F]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#D4FF3F]/[0.035] blur-3xl'
      />

      <div className='relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0 max-w-4xl'>
          {/* Micro-tags y badges superiores estilo bookie europea de alta densidad */}
          <div className='flex flex-wrap items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-widest text-metallic-slate'>
            <span className='inline-flex items-center gap-1.5 rounded-sm border border-[#D4FF3F]/40 bg-[#D4FF3F]/[0.08] px-2 py-0.5 text-[#D4FF3F]'>
              <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4FF3F]' aria-hidden='true' />
              ZENBET // SPORTSBOOK OFICIAL
            </span>
            <span className='text-[8px] text-metallic-slate/35'>ВЫСОКАЯ ПЛОТНОСТЬ · ЛИНИЯ</span>
            <span className='hidden h-3 w-px bg-white/10 sm:block' aria-hidden='true' />
            <span className='hidden items-center gap-1 text-sage sm:inline-flex'>
              <Zap size={11} className='text-[#D4FF3F]' aria-hidden='true' />
              VELOCIDAD SUB-50MS
            </span>
          </div>

          {/* Nuevo lema oficial agresivo */}
          <h1 className='mt-2 font-display text-[clamp(1.25rem,2.8vw,2.15rem)] font-extrabold uppercase leading-[1.08] tracking-tight text-white'>
            Apuestas de alta densidad.{' '}
            <span className='text-[#D4FF3F] drop-shadow-[0_0_18px_rgba(212,255,63,0.3)]'>
              Cuotas en tiempo real, velocidad extrema y control absoluto.
            </span>
          </h1>

          <p className='mt-1.5 text-xs text-metallic-slate sm:text-[13px]'>
            Plataforma brutalista de ejecución instantánea. Líneas oficiales sin intermediarios, cuotas sincronizadas por microsegundo y retornos garantizados.
          </p>
        </div>

        {/* Métricas y Estado en vivo */}
        <div className='flex shrink-0 items-center gap-3 border-t border-white/[0.07] pt-3 lg:border-t-0 lg:pt-0'>
          <div className='grid grid-cols-2 gap-2 text-left sm:flex sm:items-center'>
            <div className='rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5'>
              <span className='block font-mono text-[8px] font-bold uppercase tracking-wider text-metallic-slate'>
                EVENTOS EN VIVO
              </span>
              <span className='font-mono text-base font-bold text-[#D4FF3F] tabular-nums sm:text-lg'>
                {liveCount > 0 ? `${liveCount} LIVE` : 'DISPONIBLES'}
              </span>
            </div>

            <div className='rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-1.5'>
              <span className='block font-mono text-[8px] font-bold uppercase tracking-wider text-metallic-slate'>
                LATENCIA SIGNALR
              </span>
              <span className='flex items-center gap-1 font-mono text-base font-bold text-white tabular-nums sm:text-lg'>
                <Gauge size={13} className='text-[#D4FF3F]' aria-hidden='true' />
                &lt; 35ms
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default memo(SportsbookHeroBanner);

