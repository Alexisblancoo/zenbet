import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

import type { AuthUser } from '@/domain/auth';
import LoginModal from '@/modules/Auth/LoginModal';
import RegisterModal from '@/modules/Auth/RegisterModal';

import {
  AuthModalContext,
  type AuthModalContextValue,
  type AuthMode,
} from './authModalState';

interface AuthNotice {
  readonly title: string;
  readonly message: string;
}

/**
 * Orquesta el modal de acceso para toda la app. Header, boleto y barra móvil
 * comparten el mismo estado; el aviso verde confirma el alta o el acceso.
 */
export default function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('register');
  const [notice, setNotice] = useState<AuthNotice | null>(null);

  const openAuth = useCallback((nextMode: AuthMode = 'register') => {
    setMode(nextMode);
    setIsOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSuccess = useCallback(
    (_user: AuthUser) => {
      setIsOpen(false);
      setNotice(
        mode === 'register'
          ? {
              title: 'Cuenta creada',
              message: 'Tu cuenta está lista. Recarga saldo desde la billetera para empezar a apostar.',
            }
          : {
              title: 'Sesión iniciada',
              message: 'Tu billetera y tus apuestas están listas.',
            },
      );
    },
    [mode],
  );

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const value = useMemo<AuthModalContextValue>(
    () => ({ openAuth, closeAuth }),
    [openAuth, closeAuth],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}

      {mode === 'login' ? (
        <LoginModal
          isOpen={isOpen}
          onClose={closeAuth}
          onSuccess={handleSuccess}
          onSwitchToRegister={() => setMode('register')}
        />
      ) : (
        <RegisterModal
          isOpen={isOpen}
          onClose={closeAuth}
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setMode('login')}
        />
      )}

      {notice ? (
        <div
          role='status'
          aria-live='polite'
          className='fixed right-4 top-20 z-[120] w-[calc(100%-2rem)] max-w-sm border border-money/35 bg-[#08120E]/95 p-3.5 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:right-6'
        >
          <div className='flex items-start gap-3'>
            <span className='mt-0.5 grid h-8 w-8 shrink-0 place-items-center border border-money/35 bg-money/10 text-money'>
              <CheckCircle2 size={16} aria-hidden='true' />
            </span>
            <div className='min-w-0 flex-1'>
              <p className='font-display text-[11px] font-bold uppercase tracking-wide text-money'>
                {notice.title}
              </p>
              <p className='mt-1 text-xs leading-relaxed text-metallic-titanium'>
                {notice.message}
              </p>
            </div>
            <button
              type='button'
              onClick={() => setNotice(null)}
              aria-label='Cerrar aviso'
              className='focus-ring -mr-1 -mt-1 border border-transparent p-1.5 text-metallic-slate transition-colors hover:border-money/30 hover:text-money'
            >
              <X size={13} aria-hidden='true' />
            </button>
          </div>
        </div>
      ) : null}
    </AuthModalContext.Provider>
  );
}
