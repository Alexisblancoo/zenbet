import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Wallet, Menu, X, User, LogOut, UserPlus, LogIn } from 'lucide-react';
import AuthModal from '@/modules/Auth/AuthModal';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('register');
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(1450.00);

  // Cargar usuario inicial y saldo desde localStorage
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('zenbet_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        setUser(parsed);
        if (parsed.balance !== undefined) {
          setBalance(parsed.balance);
        }
      }
    } catch (e) {
      console.warn('Error leyendo usuario de localStorage', e);
    }

    // Escuchar eventos de actualización de saldo tras apuestas
    const handleBalanceUpdate = (e) => {
      if (typeof e.detail === 'number') {
        setBalance(e.detail);
        setUser((prev) => (prev ? { ...prev, balance: e.detail } : prev));
      }
    };

    window.addEventListener('zenbet_balance_updated', handleBalanceUpdate);
    return () => window.removeEventListener('zenbet_balance_updated', handleBalanceUpdate);
  }, []);

  const handleAuthSuccess = (authenticatedUser) => {
    if (authenticatedUser) {
      setUser(authenticatedUser);
      if (authenticatedUser.balance !== undefined) {
        setBalance(authenticatedUser.balance);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('zenbet_token');
    localStorage.removeItem('zenbet_user');
    setUser(null);
    setBalance(1450.00);
  };

  const navLinkClasses = ({ isActive }) =>
    `relative px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors duration-150 flex items-center gap-1.5 ${
      isActive
        ? 'text-white border-b-2 border-crimson'
        : 'text-metallic-titanium hover:text-white'
    }`;

  return (
    <>
      <header className='sticky top-0 z-40 w-full border-b border-obsidian-border bg-obsidian-void/90 backdrop-blur-md'>
        <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
          {/* Marca / Logo */}
          <div className='flex items-center gap-8'>
            <Link to='/' className='group flex items-center gap-2.5' aria-label='Zenbet Inicio'>
              <div className='relative flex h-8 w-8 items-center justify-center border border-crimson/80 bg-crimson/10 font-display font-black text-crimson shadow-brutal-crimson-sm transition-transform duration-200 group-hover:scale-105'>
                <span className='text-sm tracking-tighter'>Z</span>
                <span className='absolute -right-0.5 -top-0.5 h-1.5 w-1.5 bg-crimson animate-ping' />
              </div>
              <div className='flex flex-col'>
                <span className='font-display text-lg font-black tracking-tightest uppercase text-white group-hover:text-crimson transition-colors'>
                  ZENBET
                </span>
                <span className='font-mono text-[9px] uppercase tracking-ultra text-metallic-titanium'>
                  Brutalist Engine
                </span>
              </div>
            </Link>

            {/* Navegación Desktop */}
            <nav className='hidden md:flex items-center gap-2' aria-label='Navegación principal'>
              <NavLink to='/' className={navLinkClasses} end>
                Inicio
              </NavLink>
              <NavLink to='/sportsbook' className={navLinkClasses}>
                <span className='relative flex h-1.5 w-1.5' aria-hidden='true'>
                  <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75' />
                  <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson' />
                </span>
                Sportsbook
                <span className='ml-1 border border-crimson/40 bg-crimson/20 px-1 py-0.5 font-mono text-[9px] font-bold text-crimson'>
                  LIVE
                </span>
              </NavLink>
            </nav>
          </div>

          {/* Acciones y Saldo de Usuario */}
          <div className='hidden sm:flex items-center gap-3'>
            {/* Indicador de conexión en tiempo real */}
            <div className='flex items-center gap-1.5 border border-obsidian-border bg-obsidian-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-metallic-titanium'>
              <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' aria-hidden='true' />
              <span>Feed 14ms</span>
            </div>

            {/* Saldo / Billetera */}
            <div className='flex items-center gap-2 border border-obsidian-border bg-obsidian-surface px-3 py-1 font-mono text-xs'>
              <Wallet size={13} className='text-gold-imperial' aria-hidden='true' />
              <span className='text-metallic-titanium'>SALDO:</span>
              <span className='font-bold text-gold-specular tabular-nums'>${balance.toFixed(2)}</span>
            </div>

            {/* Auth Buttons o Perfil */}
            {user ? (
              <div className='flex items-center gap-2'>
                <span className='border border-obsidian-border bg-obsidian-surface px-3 py-1 font-mono text-xs text-white flex items-center gap-1.5'>
                  <User size={12} className='text-emerald-400' aria-hidden='true' />
                  <span className='truncate max-w-[100px]'>{user.username}</span>
                </span>
                <button
                  type='button'
                  onClick={handleLogout}
                  title='Cerrar Sesión'
                  aria-label='Cerrar sesión'
                  className='border border-obsidian-border bg-obsidian-surface p-1.5 text-metallic-titanium hover:text-crimson hover:border-crimson transition-colors'
                >
                  <LogOut size={13} aria-hidden='true' />
                </button>
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className='border border-obsidian-border bg-obsidian-surface px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-metallic-titanium hover:text-white hover:border-metallic-titanium transition-all flex items-center gap-1.5'
                  aria-label='Iniciar sesión'
                >
                  <LogIn size={12} aria-hidden='true' />
                  <span>Entrar</span>
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setAuthMode('register');
                    setAuthModalOpen(true);
                  }}
                  className='border-brutal-crimson bg-crimson px-3 py-1 font-display text-xs font-bold uppercase tracking-wider text-white shadow-brutal-crimson-sm transition-all hover:bg-crimson-pure active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5'
                  aria-label='Crear nueva cuenta'
                >
                  <UserPlus size={12} aria-hidden='true' />
                  <span>Registro</span>
                </button>
              </div>
            )}
          </div>

          {/* Botón Mobile Menu */}
          <div className='flex md:hidden items-center gap-2'>
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
          <div className='border-b border-obsidian-border bg-obsidian-surface px-4 py-4 md:hidden flex flex-col gap-3'>
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
              Sportsbook Live
            </NavLink>
            <div className='border-t border-obsidian-border pt-3 flex flex-col gap-2 font-mono text-xs'>
              <div className='flex items-center justify-between text-metallic-titanium'>
                <span>SALDO DISPONIBLE:</span>
                <span className='font-bold text-gold-specular'>${balance.toFixed(2)}</span>
              </div>
              {!user ? (
                <div className='grid grid-cols-2 gap-2 pt-2'>
                  <button
                    type='button'
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthMode('login');
                      setAuthModalOpen(true);
                    }}
                    className='border border-obsidian-border bg-obsidian-void py-2 text-center text-xs font-bold uppercase text-white'
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    type='button'
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthMode('register');
                      setAuthModalOpen(true);
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

      {/* Modal de Registro e Inicio de Sesión */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
