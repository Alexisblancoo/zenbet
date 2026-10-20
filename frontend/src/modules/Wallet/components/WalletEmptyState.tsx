import type { ReactNode } from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

interface WalletEmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly icon?: LucideIcon;
  readonly action?: ReactNode;
}

export function WalletEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: WalletEmptyStateProps) {
  return (
    <div className='flex flex-col items-center justify-center px-5 py-12 text-center'>
      <span className='grid h-11 w-11 place-items-center rounded-md border border-obsidian-border bg-obsidian-surface/70 text-metallic-slate'>
        <Icon size={18} strokeWidth={1.7} aria-hidden='true' />
      </span>
      <p className='mt-4 font-display text-xs font-extrabold uppercase tracking-brutal text-white'>
        {title}
      </p>
      <p className='mt-1.5 max-w-sm text-xs leading-relaxed text-metallic-titanium'>
        {description}
      </p>
      {action ? <div className='mt-4'>{action}</div> : null}
    </div>
  );
}
