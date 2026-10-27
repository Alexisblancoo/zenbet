import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface AuthModalShellProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly variant?: 'modal' | 'page';
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function AuthModalShell({
  isOpen,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  variant = 'modal',
}: AuthModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isPage = variant === 'page';

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || isPage) return undefined;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLInputElement>('input:not([type="checkbox"])')
        ?.focus();
    }, 40);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [isOpen, isPage]);

  if (!isOpen) return null;

  const closeButton = (
    <button
      type='button'
      onClick={onClose}
      aria-label={isPage ? 'Volver al inicio' : 'Cerrar autenticación'}
      className='focus-ring absolute right-3 top-3 grid h-9 w-9 place-items-center border border-transparent text-metallic-slate transition-colors duration-150 hover:border-white/[0.12] hover:bg-white/[0.03] hover:text-white'
    >
      <X size={16} aria-hidden='true' />
    </button>
  );

  const panel = (
    <div
      ref={panelRef}
      role={isPage ? undefined : 'dialog'}
      aria-modal={isPage ? undefined : 'true'}
      aria-labelledby={titleId}
      className={`relative mx-auto max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto border border-white/[0.12] bg-[#121212]/95 p-5 shadow-[0_32px_100px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-7 ${
        isPage ? 'max-w-xl' : 'max-w-lg'
      }`}
    >
      <span
        className='pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-crimson to-transparent'
        aria-hidden='true'
      />

      {closeButton}

      <div className='flex items-center gap-2 pr-10'>
        <span className='h-1.5 w-1.5 shrink-0 bg-crimson' aria-hidden='true' />
        <p className='font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-crimson'>
          {eyebrow}
        </p>
      </div>

      <h2
        id={titleId}
        className='mt-3 font-display text-[28px] font-bold leading-[1.05] tracking-[-0.035em] text-white sm:text-[31px]'
      >
        {title}
      </h2>
      <p className='mt-2 max-w-[42ch] text-[13px] leading-relaxed text-metallic-titanium'>
        {description}
      </p>

      <div className='mt-6'>{children}</div>

      {footer ? (
        <div className='mt-6 border-t border-white/[0.08] pt-4'>{footer}</div>
      ) : null}
    </div>
  );

  if (isPage) {
    return (
      <section aria-labelledby={titleId} className='w-full'>
        {panel}
      </section>
    );
  }

  return (
    <div
      className='fixed inset-0 z-modal flex items-center justify-center bg-[#050505]/85 p-3 backdrop-blur-md sm:p-5'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {panel}
    </div>
  );
}
