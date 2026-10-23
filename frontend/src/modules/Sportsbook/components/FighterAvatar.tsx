import { useMemo, useState } from 'react';

import type { UfcFighter } from '@/domain/ufc';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'hero';
type FighterCorner = 'red' | 'blue';

interface FighterAvatarProps {
  readonly fighter: UfcFighter;
  readonly corner: FighterCorner;
  readonly size?: AvatarSize;
  readonly priority?: boolean;
  readonly className?: string;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-8 w-8 text-[9px]',
  sm: 'h-9 w-9 text-[10px]',
  md: 'h-14 w-14 text-sm',
  lg: 'h-20 w-20 text-xl',
  hero: 'h-16 w-16 text-lg sm:h-20 sm:w-20 lg:h-24 lg:w-24 lg:text-2xl',
};

const FRAME_CLASSES: Record<FighterCorner, string> = {
  red: 'bg-gradient-to-br from-crimson/90 via-white/20 to-crimson/35 shadow-[0_0_30px_-10px_rgb(239_68_68_/_0.85)]',
  blue: 'bg-gradient-to-br from-electric/90 via-white/20 to-electric/35 shadow-[0_0_30px_-10px_rgb(56_189_248_/_0.8)]',
};

function initialsFor(name: string): string {
  const parts = name
    .replace(/['’]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Retrato de peleador con marco Shibuya. La imagen entra con un fundido
 * breve; si la CDN falla, las iniciales permanecen como respaldo estable.
 */
export default function FighterAvatar({
  fighter,
  corner,
  size = 'sm',
  priority = false,
  className = '',
}: FighterAvatarProps) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = useMemo(() => initialsFor(fighter.name), [fighter.name]);
  const imageUrl = fighter.imageUrl;

  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;
  const loaded = Boolean(imageUrl) && loadedUrl === imageUrl;

  return (
    <span
      role='img'
      aria-label={`Retrato de ${fighter.name}`}
      className={`relative inline-grid shrink-0 place-items-center rounded-full p-[2px] ${FRAME_CLASSES[corner]} ${className}`}
    >
      <span
        className={`relative grid place-items-center overflow-hidden rounded-full border border-white/15 bg-[#080B11] ${SIZE_CLASSES[size]}`}
      >
        <span
          aria-hidden='true'
          className={`absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_35%_20%,rgb(255_255_255_/_0.09),transparent_60%)] font-display font-bold uppercase tracking-wide text-white/60 transition-opacity duration-200 ${
            loaded && showImage ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {initials}
        </span>

        {showImage && (
          <img
            src={imageUrl ?? undefined}
            alt=''
            loading={priority ? 'eager' : 'lazy'}
            decoding='async'
            referrerPolicy='no-referrer'
            onLoad={() => setLoadedUrl(imageUrl ?? null)}
            onError={() => {
              setFailedUrl(imageUrl);
              setLoadedUrl(null);
            }}
            className={`absolute inset-0 h-full w-full object-cover object-top saturate-[0.86] contrast-[1.06] transition-[opacity,transform] duration-300 ${
              loaded ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
            }`}
          />
        )}

        <span
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_16px_rgb(0_0_0_/_0.55),inset_0_1px_0_rgb(255_255_255_/_0.16)]'
        />
        <span
          aria-hidden='true'
          className='pointer-events-none absolute inset-x-2 bottom-0 h-6 rounded-full bg-gradient-to-t from-black/45 to-transparent'
        />
      </span>
    </span>
  );
}
