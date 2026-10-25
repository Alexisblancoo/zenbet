import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ArrowRight, ReceiptText, Swords, Ticket, UserRound, UserPlus } from 'lucide-react';

import BetSlip from '@/components/BetSlip';
import { useAuthModal } from '@/context/authModalState';
import { useAuth } from '@/context/authState';
import { useBetSlip } from '@/context/betSlipState';
import { calculateTotalOdds } from '@/domain/bets';
import { formatDecimalOdds } from '@/domain/odds';

import ZenbetLogo from './ZenbetLogo';

const ITEM_CLASS =
  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-electric';

export default function MobileDock() {
  const location = useLocation();
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const { selections } = useBetSlip();
  const [slipOpen, setSlipOpen] = useState(false);
  const titleId = useId();
  const panelRef = useRef(null);

  const count = selections.length;
  const totalOdds = calculateTotalOdds(selections);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    setSlipOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!slipOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousActiveElement = document.activeElement;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSlipOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 40);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, [slipOpen]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1400px)');
    const handleChange = () => {
      if (media.matches) setSlipOpen(false);
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  if (isAuthPage) return null;

  return (
    <>
      {count > 0 && !slipOpen ? (
        <button
          type='button'
          onClick={() => setSlipOpen(true)}
          aria-label={`Abrir boleto, ${count} ${count === 1 ? 'selección' : 'selecciones'}, cuota total ${formatDecimalOdds(totalOdds)}`}
          className='reveal-up fixed inset-x-3 bottom-[calc(72px_+_env(safe-area-inset-bottom))] z-40 flex items-center justify-between gap-3 rounded-xl border border-money/25 bg-[#07130F]/95 px-3 py-2.5 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl min-[1400px]:hidden'
        >
          <span className='flex min-w-0 items-center gap-2.5'>
            <span className='grid h-8 w-8 shrink-0 place-items-center rounded-full bg-money/15 text-money'>
              <Ticket size={15} aria-hidden='true' />
            </span>
            <span className='min-w-0 text-left'>
              <span className='block font-display text-[10px] font-bold uppercase tracking-wide text-white'>
                {count} {count === 1 ? 'selección' : 'selecciones'}
              </span>
              <span className='mt-0.5 block font-mono text-[8px] uppercase tracking-wide text-money'>
                Cuota total ×{formatDecimalOdds(totalOdds)}
              </span>
            </span>
          </span>
          <span className='inline-flex shrink-0 items-center gap-1 font-display text-[10px] font-bold uppercase tracking-wide text-money'>
            Ver boleto
            <ArrowRight size={12} aria-hidden='true' />
          </span>
        </button>
      ) : null}

      <nav
        aria-label='Accesos rápidos'
        className='fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.1] bg-[#07090E]/95 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl min-[1400px]:hidden'
      >
        <div className='mx-auto grid max-w-lg grid-cols-5'>
          <NavLink
            to='/'
            end
            aria-label='Inicio ZenBet'
            className={({ isActive }) =>
              `${ITEM_CLASS} ${
                isActive ? 'text-[#FFD700]' : 'text-metallic-titanium hover:text-white'
              }`
            }
          >
            <ZenbetLogo compact />
          </NavLink>

          <NavLink
            to='/sportsbook'
            aria-label='Cartelera UFC'
            className={({ isActive }) =>
              `${ITEM_CLASS} ${
                isActive ? 'text-crimson' : 'text-metallic-titanium hover:text-white'
              }`
            }
          >
            <Swords size={18} aria-hidden='true' />
            <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
              Cartelera
            </span>
          </NavLink>

          <button
            type='button'
            onClick={() => setSlipOpen(true)}
            aria-label={`Abrir boleto de apuestas, ${count} ${
              count === 1 ? 'selección' : 'selecciones'
            }`}
            className={`${ITEM_CLASS} border-x border-white/[0.07] text-white hover:text-crimson`}
          >
            <span className='relative'>
              <Ticket size={18} className='text-crimson' aria-hidden='true' />
              {count > 0 ? (
                <span className='absolute -right-3 -top-2 grid h-4 min-w-4 place-items-center bg-money px-1 font-mono text-[9px] font-bold leading-none text-[#04120C]'>
                  {count > 9 ? '9+' : count}
                </span>
              ) : null}
            </span>
            <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
              Boleto
            </span>
          </button>

          {user ? (
            <NavLink
              to='/my-bets'
              aria-label='Abrir mis apuestas'
              className={({ isActive }) =>
                `${ITEM_CLASS} ${
                  isActive ? 'text-[#FFD700]' : 'text-metallic-titanium hover:text-white'
                }`
              }
            >
              <ReceiptText size={18} aria-hidden='true' />
              <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
                Apuestas
              </span>
            </NavLink>
          ) : (
            <button
              type='button'
              onClick={() => openAuth('login')}
              aria-label='Iniciar sesión para ver mis apuestas'
              className={`${ITEM_CLASS} text-metallic-titanium hover:text-white`}
            >
              <ReceiptText size={18} aria-hidden='true' />
              <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
                Apuestas
              </span>
            </button>
          )}

          {user ? (
            <NavLink
              to='/perfil'
              aria-label='Abrir mi perfil'
              className={({ isActive }) =>
                `${ITEM_CLASS} ${
                  isActive ? 'text-crimson' : 'text-metallic-titanium hover:text-white'
                }`
              }
            >
              <UserRound size={18} aria-hidden='true' />
              <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
                Perfil
              </span>
            </NavLink>
          ) : (
            <button
              type='button'
              onClick={() => openAuth('register')}
              aria-label='Crear cuenta o iniciar sesión'
              className={`${ITEM_CLASS} text-metallic-titanium hover:text-white`}
            >
              <UserPlus size={18} aria-hidden='true' />
              <span className='text-[9px] font-semibold uppercase tracking-[0.1em]'>
                Registro
              </span>
            </button>
          )}
        </div>
      </nav>

      {slipOpen ? (
        <div
          className='fixed inset-0 z-[65] min-[1400px]:hidden'
          role='presentation'
        >
          <button
            type='button'
            aria-label='Cerrar boleto de apuestas'
            onClick={() => setSlipOpen(false)}
            className='absolute inset-0 h-full w-full cursor-default bg-[#03050A]/80 backdrop-blur-sm'
          />

          <h2 id={titleId} className='sr-only'>
            Boleto de apuestas
          </h2>

          <div
            ref={panelRef}
            role='dialog'
            aria-modal='true'
            aria-labelledby={titleId}
            tabIndex={-1}
            className='reveal-up absolute inset-x-0 bottom-0 flex h-[min(84dvh,780px)] flex-col overflow-hidden rounded-t-2xl border-t border-white/[0.14] bg-[#07090E] shadow-[0_-30px_90px_-28px_rgba(0,0,0,0.95)] outline-none'
          >
            <div className='flex shrink-0 justify-center pb-1 pt-2' aria-hidden='true'>
              <span className='h-1 w-10 bg-white/20' />
            </div>
            <div className='min-h-0 flex-1'>
              <BetSlip
                minStake={50}
                maxStake={5000}
                onClose={() => setSlipOpen(false)}
                variant='sheet'
                className='h-full border-0'
                tourEnabled
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
