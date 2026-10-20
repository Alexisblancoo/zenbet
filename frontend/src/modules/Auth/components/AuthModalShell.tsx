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
}

export default function AuthModalShell({
  isOpen,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
}: AuthModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    const firstField = panelRef.current?.querySelector<HTMLInputElement>(
      'input:not([type="checkbox"])',
    );
    firstField?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className='fixed inset-0 z-modal flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-md'
      role='presentation'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className='glass-float edge-light reveal-up relative w-full max-w-md p-6 sm:p-8'
      >
        <span
          className='pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-crimson/70 to-transparent'
          aria-hidden='true'
        />

        <button
          type='button'
          onClick={onClose}
          aria-label='Cerrar autenticación'
          className='focus-ring absolute right-4 top-4 rounded-sm border border-transparent p-1.5 text-ink-faint transition-colors duration-base out-expo hover:border-line hover:text-ink'
        >
          <X size={16} aria-hidden='true' />
        </button>

        <p className='font-mono text-2xs font-bold uppercase tracking-ultra text-crimson'>
          {eyebrow}
        </p>
        <h2
          id={titleId}
          className='mt-2 font-display text-2xl font-black uppercase tracking-tightest text-ink'
        >
          {title}
        </h2>
        <p className='mt-2 max-w-[34ch] text-sm leading-relaxed text-ink-muted'>{description}</p>

        <div className='mt-6'>{children}</div>

        {footer ? <div className='mt-6 hairline-top pt-4'>{footer}</div> : null}
      </div>
    </div>
  );
}
