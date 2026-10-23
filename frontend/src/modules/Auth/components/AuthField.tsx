import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface AuthFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly icon: LucideIcon;
  readonly type?: 'text' | 'email' | 'password';
  readonly placeholder?: string;
  readonly autoComplete?: string;
  readonly inputMode?: 'text' | 'email' | 'numeric';
  readonly error?: string;
  readonly hint?: string;
  readonly valid?: boolean;
  readonly successMessage?: string;
}

export default function AuthField({
  id,
  label,
  value,
  onChange,
  onBlur,
  icon: Icon,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  error,
  hint,
  valid = false,
  successMessage,
}: AuthFieldProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword && passwordVisible ? 'text' : type;
  const hasSuccess = valid && !error && Boolean(successMessage);
  const messageId = error || hasSuccess || hint ? `${id}-message` : undefined;

  const borderClasses = error
    ? 'border-crimson/70 bg-crimson/[0.035]'
    : hasSuccess
      ? 'border-money/45 bg-money/[0.025]'
      : 'border-white/[0.13] bg-white/[0.025] hover:border-white/[0.22] focus-within:border-electric/70 focus-within:bg-white/[0.04]';

  return (
    <div className='space-y-1.5'>
      <label
        htmlFor={id}
        className='block font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-metallic-slate'
      >
        {label}
      </label>

      <div
        className={`flex min-h-12 w-full items-center border transition-colors duration-150 focus-within:ring-1 focus-within:ring-electric/25 ${borderClasses}`}
      >
        <Icon
          size={16}
          className={`ml-3.5 shrink-0 ${
            error ? 'text-crimson' : hasSuccess ? 'text-money' : 'text-metallic-slate'
          }`}
          aria-hidden='true'
        />

        <input
          id={id}
          type={resolvedType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={Boolean(error)}
          aria-required='true'
          aria-describedby={messageId}
          spellCheck={false}
          className={`h-12 w-full min-w-0 bg-transparent px-3 font-sans text-sm text-white outline-none placeholder:text-metallic-slate/70 ${
            isPassword ? 'pr-11' : hasSuccess ? 'pr-10' : 'pr-3'
          }`}
        />

        {hasSuccess && !isPassword ? (
          <CheckCircle2 size={15} className='mr-3 shrink-0 text-money' aria-hidden='true' />
        ) : null}

        {isPassword ? (
          <button
            type='button'
            onClick={() => setPasswordVisible((previous) => !previous)}
            aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={passwordVisible}
            className='focus-ring mr-1.5 grid h-9 w-9 shrink-0 place-items-center border border-transparent text-metallic-slate transition-colors hover:border-white/[0.12] hover:text-white'
          >
            {passwordVisible ? (
              <EyeOff size={15} aria-hidden='true' />
            ) : (
              <Eye size={15} aria-hidden='true' />
            )}
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={messageId}
          role='alert'
          className='flex items-start gap-1.5 text-[11px] font-medium leading-relaxed text-crimson'
        >
          <AlertCircle size={12} className='mt-0.5 shrink-0' aria-hidden='true' />
          <span>{error}</span>
        </p>
      ) : hasSuccess ? (
        <p
          id={messageId}
          className='flex items-center gap-1.5 text-[11px] font-medium text-money'
        >
          <CheckCircle2 size={12} aria-hidden='true' />
          <span>{successMessage}</span>
        </p>
      ) : hint ? (
        <p id={messageId} className='text-[10px] leading-relaxed text-metallic-slate'>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
