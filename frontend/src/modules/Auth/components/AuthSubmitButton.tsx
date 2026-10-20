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
      className='focus-ring group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md border border-crimson/60 bg-gradient-crimson-fire px-4 py-3 font-display text-xs font-bold uppercase tracking-brutal text-white shadow-glow-crimson transition-all duration-base out-expo hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none'
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
