import { Link } from 'react-router-dom';

const MARK_SIZES = {
  sm: {
    frame: 'h-6 w-6',
    inner: 'inset-[2px]',
    corner: 'h-1 w-1',
    letter: 'text-[13px]',
  },
  md: {
    frame: 'h-10 w-10',
    inner: 'inset-[3px]',
    corner: 'h-1.5 w-1.5',
    letter: 'text-[21px]',
  },
} as const;

interface ZenbetMarkProps {
  readonly size?: keyof typeof MARK_SIZES;
  readonly className?: string;
}

/**
 * Isotipo de ZenBet. El dorado se declara de forma explícita para no depender
 * del token cromático del resto del sistema, que aquí es plateado.
 */
export function ZenbetMark({ size = 'md', className = '' }: ZenbetMarkProps) {
  const scale = MARK_SIZES[size];

  return (
    <span
      aria-hidden='true'
      className={`relative grid shrink-0 place-items-center overflow-hidden border border-lime-400 bg-[#0D0D0D] shadow-[0_0_0_1px_rgba(212,255,63,0.14),0_0_24px_-9px_rgba(212,255,63,0.65)] ${scale.frame} ${className}`}
    >
      <span
        className={`pointer-events-none absolute border border-lime-400/20 ${scale.inner}`}
      />
      <span
        className={`pointer-events-none absolute left-0 top-0 border-l border-t border-lime-400/90 ${scale.corner}`}
      />
      <span
        className={`pointer-events-none absolute right-0 top-0 border-r border-t border-lime-400/90 ${scale.corner}`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 left-0 border-b border-l border-lime-400/90 ${scale.corner}`}
      />
      <span
        className={`pointer-events-none absolute bottom-0 right-0 border-b border-r border-lime-400/90 ${scale.corner}`}
      />
      <span
        className={`relative font-display font-black leading-none tracking-[-0.1em] text-lime-400 [text-shadow:0_0_16px_rgba(212,255,63,0.5)] ${scale.letter}`}
      >
        Z
      </span>
    </span>
  );
}

interface ZenbetLogoProps {
  readonly compact?: boolean;
  readonly className?: string;
}

export default function ZenbetLogo({ compact = false, className = '' }: ZenbetLogoProps) {
  if (compact) {
    return (
      <span className={`flex flex-col items-center gap-0.5 ${className}`}>
        <ZenbetMark size='sm' />
        <span className='font-display text-[8px] font-bold uppercase leading-none tracking-[0.18em] text-white'>
          ZENBET
        </span>
        <span className='flex items-center gap-1 whitespace-nowrap font-mono text-[5px] uppercase leading-none tracking-[0.12em] text-lime-400'>
          SHIBUYA <span className='text-white/40'>/</span>{' '}
          <span className='text-lime-400/90'>渋谷夜市</span>
        </span>
      </span>
    );
  }

  return (
    <Link
      to='/'
      className={`group flex items-center gap-3 ${className}`}
      aria-label='ZenBet Inicio'
    >
      <ZenbetMark className='transition-shadow duration-200 group-hover:shadow-[0_0_0_1px_rgba(212,255,63,0.28),0_0_30px_-7px_rgba(212,255,63,0.78)]' />
      <span className='flex min-w-0 flex-col'>
        <span className='font-display text-[20px] font-bold uppercase leading-none tracking-[0.18em] text-white sm:text-[21px]'>
          ZENBET
        </span>
        <span className='mt-1 flex items-center gap-1.5 whitespace-nowrap font-mono text-[8px] uppercase leading-none tracking-[0.17em] text-lime-400 sm:text-[9px]'>
          <span aria-hidden='true' className='h-px w-3 bg-lime-400/60' />
          SHIBUYA <span className='text-white/40'>/</span>{' '}
          <span className='text-lime-400/90'>渋谷夜市</span>
        </span>
      </span>
    </Link>
  );
}
