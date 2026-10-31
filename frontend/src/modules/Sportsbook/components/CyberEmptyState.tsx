import { memo, type ComponentType } from 'react';
import { Database, ArrowLeft, RefreshCw, Radio } from 'lucide-react';

export interface CyberEmptyStateProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly sportLabel?: string;
  readonly venue?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly icon?: ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  readonly cyrillicBadge?: string;
  readonly telemetryCode?: string;
}

/**
 * Componente de estado vacío estilizado bajo la identidad visual Cyber-Grunge de ZenBet.
 * Fondos estrictos #0D0D0D y #050505, micro-detalles de telemetría y acentos lima #D4FF3F.
 */
function CyberEmptyState({
  title = 'Sin eventos activos / Próximamente en esta sede',
  subtitle = 'No hay mercados o cuotas publicadas en este momento para la selección actual. Los eventos se sincronizan en vivo desde la API de cuotas.',
  sportLabel,
  venue,
  actionLabel,
  onAction,
  icon: Icon = Database,
  cyrillicBadge = 'СИСТЕМА: ПУСТО',
  telemetryCode = 'STATUS: IDLE // 0x00_NO_DATA',
}: CyberEmptyStateProps) {
  return (
    <div
      role='region'
      aria-label={title}
      className='relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-6 sm:p-8 shadow-2xl transition-all duration-200'
    >
      {/* Scanline ambiental y brillo radial neon */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_25%,rgba(212,255,63,0.06),transparent_45%)]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4FF3F]/30 to-transparent'
      />

      <div className='relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-start gap-4'>
          {/* Icon Box Cyber-Grunge */}
          <div className='relative grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[#D4FF3F]/30 bg-[#050505] text-[#D4FF3F] shadow-[0_0_15px_rgba(212,255,63,0.15)]'>
            <Icon size={22} aria-hidden='true' />
            <span
              aria-hidden='true'
              className='absolute -bottom-1 -right-1 h-1.5 w-1.5 rounded-full bg-[#D4FF3F] shadow-[0_0_6px_#D4FF3F]'
            />
          </div>

          <div className='min-w-0 space-y-1.5'>
            {/* Cabecera Técnica */}
            <div className='flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-wider'>
              <span className='inline-flex items-center gap-1 border border-[#D4FF3F]/30 bg-[#D4FF3F]/[0.08] px-1.5 py-0.5 font-bold text-[#D4FF3F]'>
                <Radio size={8} className='animate-pulse' aria-hidden='true' />
                {telemetryCode}
              </span>
              <span className='border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-neutral-400'>
                {cyrillicBadge}
              </span>
              {sportLabel && (
                <span className='border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 text-neutral-400'>
                  DISCIPLINA: {sportLabel.toUpperCase()}
                </span>
              )}
              {venue && (
                <span className='border border-white/[0.08] bg-white/[0.02] px-1.5 py-0.5 text-neutral-400'>
                  SEDE: {venue.toUpperCase()}
                </span>
              )}
            </div>

            {/* Título Principal */}
            <h3 className='font-display text-base sm:text-lg font-bold uppercase tracking-tight text-white'>
              {title}
            </h3>

            {/* Subtítulo Descriptivo */}
            <p className='max-w-xl font-mono text-xs leading-relaxed text-neutral-400'>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Botón de Acción Opcional */}
        {actionLabel && onAction && (
          <div className='flex shrink-0 sm:self-center'>
            <button
              type='button'
              onClick={onAction}
              className='inline-flex items-center justify-center gap-2 border border-[#D4FF3F]/50 bg-[#D4FF3F]/10 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#D4FF3F] transition-colors duration-150 hover:border-[#D4FF3F] hover:bg-[#D4FF3F]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4FF3F]/60'
            >
              <ArrowLeft size={12} aria-hidden='true' />
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CyberEmptyState);

