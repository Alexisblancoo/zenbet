import {
  WALLET_BET_STATUS_LABELS,
  WALLET_TRANSACTION_STATUS_LABELS,
  type WalletBetStatus,
  type WalletTransactionStatus,
} from '@/domain/wallet';

type BadgeTone = 'pending' | 'won' | 'lost' | 'cancelled' | 'completed' | 'failed';

const TONE_CLASSES: Record<BadgeTone, { container: string; dot: string }> = {
  pending: {
    container: 'border-odds-live/35 bg-odds-live/10 text-odds-live',
    dot: 'bg-odds-live',
  },
  won: {
    container: 'border-odds-up/35 bg-odds-up/10 text-odds-up',
    dot: 'bg-odds-up',
  },
  lost: {
    container: 'border-odds-down/35 bg-odds-down/10 text-odds-down',
    dot: 'bg-odds-down',
  },
  cancelled: {
    container: 'border-obsidian-border bg-obsidian-elevated/80 text-metallic-titanium',
    dot: 'bg-metallic-slate',
  },
  completed: {
    container: 'border-odds-up/25 bg-odds-up/5 text-odds-up',
    dot: 'bg-odds-up/80',
  },
  failed: {
    container: 'border-odds-down/35 bg-odds-down/10 text-odds-down',
    dot: 'bg-odds-down',
  },
};

interface WalletStatusBadgeProps {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly className?: string;
}

export function WalletStatusBadge({ label, tone, className = '' }: WalletStatusBadgeProps) {
  const presentation = TONE_CLASSES[tone];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-brutal ${presentation.container} ${className}`}
    >
      <span
        aria-hidden='true'
        className={`h-1 w-1 shrink-0 rounded-full ${presentation.dot}`}
      />
      {label}
    </span>
  );
}

export function BetStatusBadge({ status }: { readonly status: WalletBetStatus }) {
  const tone: BadgeTone = status;

  return <WalletStatusBadge label={WALLET_BET_STATUS_LABELS[status]} tone={tone} />;
}

export function TransactionStatusBadge({
  status,
}: {
  readonly status: WalletTransactionStatus;
}) {
  return (
    <WalletStatusBadge
      label={WALLET_TRANSACTION_STATUS_LABELS[status]}
      tone={status}
    />
  );
}
