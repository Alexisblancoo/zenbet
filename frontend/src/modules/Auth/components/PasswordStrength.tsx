interface PasswordStrengthProps {
  readonly password: string;
}

const LEVELS = [
  { label: 'Débil', className: 'bg-odds-down' },
  { label: 'Media', className: 'bg-odds-live' },
  { label: 'Fuerte', className: 'bg-odds-up' },
] as const;

function scorePassword(password: string): number {
  if (!password) return -1;

  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  return Math.min(score, LEVELS.length) - 1;
}

export default function PasswordStrength({ password }: PasswordStrengthProps) {
  const score = scorePassword(password);
  if (score < 0) return null;

  const level = LEVELS[score];

  return (
    <div className='flex items-center gap-2'>
      <div className='flex flex-1 gap-1' aria-hidden='true'>
        {LEVELS.map((_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors duration-base out-expo ${
              index <= score ? level.className : 'bg-line'
            }`}
          />
        ))}
      </div>
      <span className='font-mono text-2xs uppercase tracking-brutal text-ink-faint'>
        {level.label}
      </span>
    </div>
  );
}
