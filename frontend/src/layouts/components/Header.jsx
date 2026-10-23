import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Wallet,
  Menu,
  X,
  User,
  LogOut,
  UserPlus,
  LogIn,
  ChevronRight,
  ReceiptText,
} from 'lucide-react';

import { useAuthModal } from '@/context/authModalState';
import { useAuth } from '@/context/authState';
import ZenbetLogo from './ZenbetLogo';

export default function Header() {
  const { user, logout } = useAuth();
  const { openAuth } = useAuthModal();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const balanceLabel = user ? `$${user.walletBalance.toFixed(2)}` : '$—';

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  const navLinkClasses = ({ isActive }) =>
    `relative px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors duration-150 flex items-center gap-1.5 ${
      isActive
        ? 'text-white border-b-2 border-crimson'
        : 'text-metallic-titanium hover:text-white'
    }`;

  return (
    <>
      <header className='sticky top-0 z-40 w-full border-b border-white/[0.09] bg-[#07090E]/95 backdrop-blur-xl'>
        <div className='mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8'>
          {/* Marca / Logo */}
          <div className='flex min-w-0 items-center gap-6 xl:gap-8'>
            <ZenbetLogo />

            {/* Navegación Desktop */}
            <nav className='hidden items-center gap-1 lg:flex' aria-label='Navegación principal'>
              <NavLink to='/' className={navLinkClasses} end>
                Inicio
              </NavLink>
              <NavLink to='/sportsbook' className={navLinkClasses}>
                <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
                Sportsbook
                <span className='ml-1 border border-crimson/40 bg-crimson/10 px-1 py-0.5 font-mono text-[8px] font-bold text-crimson'>
                  UFC
                </span>
              </NavLink>
              {user ? (
                <NavLink to='/my-bets' className={navLinkClasses}>
                  <ReceiptText size={12} aria-hidden='true' />
                  Mis apuestas
                </NavLink>
              ) : null}
            </nav>
          </div>

          {/* Acciones y Saldo de Usuario */}
          <div className='hidden sm:flex items-center gap-3'>
            {/* Contexto de la cartelera publicada */}
            <div className='hidden items-center gap-1.5 border border-crimson/35 bg-crimson/[0.08] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-crimson md:flex'>
              <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
              <span>UFC · PRÓXIMAS</span>
            </div>

            {/* Saldo / Billetera */}
            {user ? (
              <Link
                to='/wallet'
                title='Abrir mi billetera'
                className='group flex items-center gap-2 border border-white/10 bg-obsidian-surface px-3 py-1 font-mono text-xs transition-colors hover:border-money/45 hover:bg-obsidian-elevated'
              >
                <Wallet size={13} className='text-money' aria-hidden='true' />
                <span className='text-metallic-titanium'>SALDO:</span>
                <span className='font-bold text-money tabular-nums'>{balanceLabel}</span>
                <ChevronRight
                  size={12}
                  className='text-metallic-slate transition-colors group-hover:text-money'
                  aria-hidden='true'
                />
              </Link>
            ) : null}

            {/* Auth Buttons o Perfil */}
            {user ? (
              <div className='flex items-center gap-2'>
                <Link
                  to='/perfil'
                  title={`Perfil de ${user.username}`}
                  className='group flex items-center gap-2 border border-white/10 bg-obsidian-surface px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-metallic-titanium transition-colors hover:border-white/25 hover:text-white'
                  aria-label='Abrir mi perfil'
                >
                  <User size={12} className='text-white/75' aria-hidden='true' />
                  <span>Perfil</span>
                </Link>
                <button
                  type='button'
                  onClick={handleLogout}
                  title='Cerrar Sesión'
                  aria-label='Cerrar sesión'
                  className='border border-obsidian-border bg-obsidian-surface p-1.5 text-metallic-titanium transition-colors hover:border-crimson hover:text-crimson'
                >
                  <LogOut size={13} aria-hidden='true' />
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => openAuth('login')}
                  className='border border-obsidian-border bg-obsidian-surface px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-metallic-titanium hover:text-white hover:border-metallic-titanium transition-all flex items-center gap-1.5'
                  aria-label='Iniciar sesión'
                >
                  <LogIn size={12} aria-hidden='true' />
                  <span>Entrar</span>
                </button>
                <button
                  type='button'
                  onClick={() => openAuth('register')}
                  className='flex items-center gap-1.5 border border-crimson-pure bg-crimson-pure px-3 py-1 font-display text-xs font-bold uppercase tracking-wide text-white shadow-brutal-crimson-sm transition-all hover:brightness-110 active:translate-x-0.5 active:translate-y-0.5'
                  aria-label='Crear nueva cuenta'
                >
                  <UserPlus size={12} aria-hidden='true' />
                  <span>Registro</span>
                </button>
              </div>
            )}
          </div>

          {/* Botón Mobile Menu */}
          <div className='flex lg:hidden items-center gap-2'>
            {user ? (
              <Link
                to='/wallet'
                aria-label={`Mi saldo disponible: ${balanceLabel}`}
                className='flex items-center gap-1.5 border border-white/10 bg-obsidian-surface px-2 py-1.5 font-mono text-[10px] transition-colors hover:border-money/45 sm:hidden'
              >
                <Wallet size={12} className='text-money' aria-hidden='true' />
                <span className='font-bold text-money tabular-nums'>{balanceLabel}</span>
              </Link>
            ) : (
              <button
                type='button'
                onClick={() => openAuth('login')}
                aria-label='Iniciar sesión'
                className='border border-obsidian-border bg-obsidian-surface px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider text-metallic-titanium transition-colors hover:border-metallic-titanium hover:text-white sm:hidden'
              >
                Entrar
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className='border border-obsidian-border bg-obsidian-surface p-2 text-metallic-titanium hover:text-white'
              aria-label='Alternar menú de navegación'
            >
              {mobileMenuOpen ? <X size={20} aria-hidden='true' /> : <Menu size={20} aria-hidden='true' />}
            </button>
          </div>
        </div>

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <div className='border-b border-obsidian-border bg-obsidian-surface px-4 py-4 lg:hidden flex flex-col gap-3'>
            <NavLink
              to='/'
              onClick={() => setMobileMenuOpen(false)}
              className='font-display text-sm font-bold uppercase tracking-wider text-white py-1'
            >
              Inicio
            </NavLink>
            <NavLink
              to='/sportsbook'
              onClick={() => setMobileMenuOpen(false)}
              className='flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-crimson py-1'
            >
              Sportsbook UFC
            </NavLink>
            {user ? (
              <>
                <NavLink
                  to='/my-bets'
                  onClick={() => setMobileMenuOpen(false)}
                  className='flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white py-1'
                >
                  <ReceiptText size={14} aria-hidden='true' />
                  Mis apuestas
                </NavLink>
                <Link
                  to='/wallet'
                  onClick={() => setMobileMenuOpen(false)}
                  className='flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-money py-1'
                >
                  <Wallet size={14} aria-hidden='true' />
                  Mi billetera
                </Link>
                <Link
                  to='/perfil'
                  onClick={() => setMobileMenuOpen(false)}
                  className='flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-white py-1'
                >
                  <User size={14} aria-hidden='true' />
                  Mi perfil
                </Link>
              </>
            ) : null}
            <div className='border-t border-obsidian-border pt-3 flex flex-col gap-2 font-mono text-xs'>
              <div className='flex items-center justify-between text-metallic-titanium'>
                <span>SALDO DISPONIBLE:</span>
                <span className='font-bold text-money tabular-nums'>{balanceLabel}</span>
              </div>
              {!user ? (
                <div className='grid grid-cols-2 gap-2 pt-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuth('login');
                    }}
                    className='border border-obsidian-border bg-obsidian-void py-2 text-center text-xs font-bold uppercase text-white'
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuth('register');
                    }}
                    className='bg-crimson py-2 text-center text-xs font-bold uppercase text-white'
                  >
                    Registro
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className='border border-crimson/50 text-crimson py-1.5 text-center text-xs font-bold uppercase'
                >
                  Cerrar Sesión ({user.username})
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
