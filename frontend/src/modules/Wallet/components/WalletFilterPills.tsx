export interface WalletFilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly count: number;
}

interface WalletFilterPillsProps<T extends string> {
  readonly options: readonly WalletFilterOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

/**
 * Filtros tipo pill. Envuelven en varias líneas en pantallas estrechas para que
 * ninguna opción quede escondida en un scroll horizontal.
 */
export function WalletFilterPills<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: WalletFilterPillsProps<T>) {
  return (
    <div
      role='group'
      aria-label={ariaLabel}
      className={`grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type='button'
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`inline-flex min-w-0 items-center justify-between gap-1.5 rounded-sm border px-2.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson/60 ${
              active
                ? 'border-crimson/50 bg-crimson/10 text-white'
                : 'border-obsidian-border/70 bg-obsidian-surface/40 text-metallic-titanium hover:border-metallic-slate/70 hover:text-white'
            }`}
          >
            <span className='min-w-0 truncate'>{option.label}</span>
            <span
              className={`shrink-0 rounded-sm px-1 py-0.5 font-mono text-[8px] ${
                active
                  ? 'bg-crimson/15 text-crimson-200'
                  : 'bg-obsidian-elevated text-metallic-slate'
              }`}
            >
              {option.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
