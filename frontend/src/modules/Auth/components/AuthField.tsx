import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';

interface AuthFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly icon: LucideIcon;
  readonly type?: 'text' | 'email' | 'password';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly error?: string;
  readonly hint?: string;
}

export default function AuthField({
  id,
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  placeholder,
  autoComplete,
  error,
  hint,
}: AuthFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = !error && hint ? `${id}-hint` : undefined;

  return (
    <div className='space-y-1.5'>
      <label
        htmlFor={id}
        className='block font-mono text-2xs font-bold uppercase tracking-brutal text-ink-muted'
      >
        {label}
      </label>

      <div className='relative'>
        <Icon
          size={15}
          className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
            error ? 'text-odds-down' : 'text-ink-faint'
          }`}
          aria-hidden='true'
        />

        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId ?? hintId}
          className={`focus-ring w-full rounded-md border bg-canvas-raised/80 py-2.5 pl-9 pr-3 font-sans text-sm text-ink transition-colors duration-base out-expo placeholder:text-ink-faint ${
            error
              ? 'border-odds-down/70 focus:border-odds-down'
              : 'border-line focus:border-crimson/70'
          }`}
        />
      </div>

      {error ? (
        <p
          id={errorId}
          role='alert'
          className='flex items-center gap-1.5 font-mono text-xs text-odds-down'
        >
          <AlertCircle size={12} aria-hidden='true' />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className='font-mono text-2xs text-ink-faint'>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
