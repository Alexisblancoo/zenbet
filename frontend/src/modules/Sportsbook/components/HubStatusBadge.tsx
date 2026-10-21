import type { OddsHubStatus } from '@/hooks/useOddsHub';

interface StatusPresentation {
  readonly label: string;
  readonly tone: string;
  readonly dot: string;
  readonly pulsing: boolean;
}

const STATUS_PRESENTATION: Record<OddsHubStatus, StatusPresentation> = {
  connected: {
    label: 'Cuotas en vivo',
    tone: 'border-odds-up/45 text-odds-up',
    dot: 'bg-odds-up',
    pulsing: false,
  },
  connecting: {
    label: 'Conectando',
    tone: 'border-odds-live/45 text-odds-live',
    dot: 'bg-odds-live',
    pulsing: true,
  },
  reconnecting: {
    label: 'Reconectando',
    tone: 'border-odds-live/45 text-odds-live',
    dot: 'bg-odds-live',
    pulsing: true,
  },
  disconnected: {
    label: 'Cuotas de referencia',
    tone: 'border-obsidian-border text-metallic-titanium',
    dot: 'bg-metallic-gunmetal',
    pulsing: false,
  },
};

interface HubStatusBadgeProps {
  readonly status: OddsHubStatus;
  readonly lastUpdateAt?: number | null;
}

/** Chip de estado del canal SignalR; altura fija para no provocar layout shift. */
export default function HubStatusBadge({ status, lastUpdateAt }: HubStatusBadgeProps) {
  const presentation = STATUS_PRESENTATION[status];
  const updatedAtLabel = lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString('es-MX') : null;

  return (
    <span
      role='status'
      aria-live='polite'
      title={updatedAtLabel ? `Última cuota recibida: ${updatedAtLabel}` : undefined}
      className={`inline-flex items-center gap-2 border bg-obsidian-elevated/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-brutal ${presentation.tone}`}
    >
      <span className='relative flex h-1.5 w-1.5' aria-hidden='true'>
        {status === 'connected' && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${presentation.dot} opacity-70`}
          />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${presentation.dot} ${
            presentation.pulsing ? 'animate-pulse' : ''
          }`}
        />
      </span>
      <span>{presentation.label}</span>
    </span>
  );
}
