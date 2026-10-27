import { Link } from 'react-router-dom';

const MARK_SIZES = {
  sm: 'h-7 w-7',
  md: 'h-12 w-12',
} as const;

interface ZenbetMarkProps {
  readonly size?: keyof typeof MARK_SIZES;
  readonly className?: string;
}

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

/**
 * Isotipo de ZenBet: dragón lima #D4FF3F con una Z grande detrás (PNG transparente
 * en public/logo.png).
 */
export function ZenbetMark({ size = 'md', className = '' }: ZenbetMarkProps) {
  return (
    <img
      src={LOGO_SRC}
      alt=''
      aria-hidden='true'
      decoding='async'
      draggable={false}
      className={`shrink-0 select-none object-contain ${MARK_SIZES[size]} ${className}`}
    />
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
      <ZenbetMark className='transition-[filter] duration-200 group-hover:drop-shadow-[0_0_12px_rgba(212,255,63,0.55)]' />
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
