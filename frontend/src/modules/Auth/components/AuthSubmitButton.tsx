import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface AuthSubmitButtonProps {
  readonly children: ReactNode;
  readonly loadingLabel: string;
  readonly isSubmitting: boolean;
  readonly disabled?: boolean;
}

export default function AuthSubmitButton({
  children,
  loadingLabel,
  isSubmitting,
  disabled = false,
}: AuthSubmitButtonProps) {
  const isDisabled = isSubmitting || disabled;

  return (
    <button
      type='submit'
      disabled={isDisabled}
      aria-busy={isSubmitting}
      className='focus-ring flex min-h-12 w-full items-center justify-center gap-2 border border-crimson-pure bg-crimson-pure px-4 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[0_14px_40px_-16px_rgba(239,68,68,0.85)] transition-all duration-150 hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.06] disabled:text-metallic-slate disabled:shadow-none'
    >
      {isSubmitting ? (
        <>
          <Loader2 size={15} className='animate-spin' aria-hidden='true' />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
