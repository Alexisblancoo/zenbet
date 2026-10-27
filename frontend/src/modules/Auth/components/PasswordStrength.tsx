interface PasswordStrengthProps {
  readonly password: string;
}

const LEVELS = [
  { label: 'Débil', textClass: 'text-crimson', barClass: 'bg-crimson' },
  { label: 'Media', textClass: 'text-sage', barClass: 'bg-sage' },
  { label: 'Fuerte', textClass: 'text-money', barClass: 'bg-money' },
] as const;

function scorePassword(password: string): number {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, 4);
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const score = scorePassword(password);
  const level = score >= 3 ? LEVELS[2] : score === 2 ? LEVELS[1] : LEVELS[0];
  const filledBars = Math.max(1, Math.min(score, 4));

  return (
    <div className='space-y-1.5' aria-live='polite'>
      <div
        className='flex gap-1'
        role='progressbar'
        aria-label='Fortaleza de la contraseña'
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={score}
        aria-valuetext={level.label}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 transition-colors duration-150 ${
              index < filledBars ? level.barClass : 'bg-white/10'
            }`}
            aria-hidden='true'
          />
        ))}
      </div>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-[10px] leading-relaxed text-metallic-slate'>
          8+ caracteres · mayúscula y número
        </span>
        <span
          className={`font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${level.textClass}`}
        >
          {level.label}
        </span>
      </div>
    </div>
  );
}
