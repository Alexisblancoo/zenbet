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
    tone: 'border-crimson/45 text-crimson',
    dot: 'bg-crimson',
    pulsing: false,
  },
  connecting: {
    label: 'Conectando',
    tone: 'border-sage/45 text-sage',
    dot: 'bg-sage',
    pulsing: true,
  },
  reconnecting: {
    label: 'Reconectando',
    tone: 'border-sage/45 text-sage',
    dot: 'bg-sage',
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
  /** Etiqueta alternativa para el canal de combates. */
  readonly label?: string;
}

/** Chip de estado del canal SignalR; altura fija para no provocar layout shift. */
export default function HubStatusBadge({ status, lastUpdateAt, label }: HubStatusBadgeProps) {
  const presentation = STATUS_PRESENTATION[status];
  const updatedAtLabel = lastUpdateAt ? new Date(lastUpdateAt).toLocaleTimeString('es-MX') : null;

  return (
    <span
      role='status'
      aria-live='polite'
      title={updatedAtLabel ? `Última actualización recibida: ${updatedAtLabel}` : undefined}
      className={`inline-flex items-center gap-2 border bg-obsidian-elevated/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-brutal ${presentation.tone}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${presentation.dot} ${
          status === 'connected'
            ? 'animate-live-breathe'
            : presentation.pulsing
              ? 'animate-pulse'
              : ''
        }`}
        aria-hidden='true'
      />
      <span>{label ?? presentation.label}</span>
    </span>
  );
}
