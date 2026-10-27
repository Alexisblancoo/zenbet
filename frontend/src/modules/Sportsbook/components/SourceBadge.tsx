import { ExternalLink, Radio } from 'lucide-react';

import {
  formatSnapshotAt,
  marketSourceLabel,
  type UfcMarketSource,
} from '@/domain/ufc';

interface SourceBadgeProps {
  readonly source: UfcMarketSource | null;
  readonly compact?: boolean;
  readonly className?: string;
}

/**
 * Procedencia visible de una cuota. UFCalendar publica un consenso promedio:
 * el enlace permite verificar el snapshot y el timestamp evita presentarlo
 * como un feed en vivo.
 */
export default function SourceBadge({
  source,
  compact = false,
  className = '',
}: SourceBadgeProps) {
  const label = marketSourceLabel(source);
  const observedAt = formatSnapshotAt(source?.observedAt ?? null);
  const title = source?.note
    ? `${label}. ${source.note}`
    : 'Cuota de referencia. Verifica la fuente antes de apostar.';

  const content = (
    <>
      <span className='relative flex h-1.5 w-1.5 shrink-0' aria-hidden='true'>
        <span className='absolute inset-0 rounded-full bg-sage/50 blur-[2px]' />
        <span className='relative h-1.5 w-1.5 rounded-full bg-sage' />
      </span>
      <Radio size={10} className='shrink-0 text-sage' aria-hidden='true' />
      <span className='truncate font-mono text-[9px] font-bold uppercase tracking-wide text-sage'>
        {label}
      </span>
      {observedAt && !compact && (
        <span className='shrink-0 font-mono text-[8px] uppercase tracking-wide text-metallic-titanium'>
          {observedAt}
        </span>
      )}
      {source?.url && (
        <ExternalLink
          size={9}
          className='shrink-0 text-metallic-slate transition-colors group-hover:text-sage'
          aria-hidden='true'
        />
      )}
    </>
  );

  const baseClass = `source-badge group inline-flex min-w-0 max-w-full items-center gap-1.5 ${className}`;

  if (source?.url) {
    return (
      <a
        href={source.url}
        target='_blank'
        rel='noreferrer noopener'
        title={title}
        aria-label={`${label}. Abrir fuente en una pestaña nueva. ${source.note ?? ''}`}
        className={`${baseClass} transition-colors hover:border-sage/55 hover:bg-sage/[0.1]`}
      >
        {content}
      </a>
    );
  }

  return (
    <span title={title} className={baseClass}>
      {content}
    </span>
  );
}
