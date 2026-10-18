import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Wallet, Menu, X } from 'lucide-react';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClasses = ({ isActive }) =>
    `relative px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors duration-150 flex items-center gap-1.5 ${
      isActive
        ? 'text-white border-b-2 border-crimson'
        : 'text-metallic-titanium hover:text-white'
    }`;

  return (
    <header className='sticky top-0 z-50 w-full border-b border-obsidian-border bg-obsidian-void/90 backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
        {/* Marca / Logo */}
        <div className='flex items-center gap-8'>
          <Link to='/' className='group flex items-center gap-2.5'>
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
          <nav className='hidden md:flex items-center gap-2'>
            <NavLink to='/' className={navLinkClasses} end>
              Inicio
            </NavLink>
            <NavLink to='/sportsbook' className={navLinkClasses}>
              <span className='relative flex h-1.5 w-1.5'>
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
            <span className='h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse' />
            <span>Feed 14ms</span>
          </div>

          {/* Saldo / Billetera */}
          <div className='flex items-center gap-2 border border-obsidian-border bg-obsidian-surface px-3 py-1 font-mono text-xs'>
            <Wallet size={13} className='text-gold-imperial' />
            <span className='text-metallic-titanium'>SALDO:</span>
            <span className='font-bold text-gold-specular'>$1,450.00</span>
          </div>

          {/* Botón de Depósito Rápido */}
          <button className='border-brutal-crimson bg-crimson px-3.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-white shadow-brutal-crimson-sm transition-all hover:bg-crimson-pure active:translate-x-0.5 active:translate-y-0.5'>
            Depositar
          </button>
        </div>

        {/* Botón Mobile Menu */}
        <div className='flex md:hidden items-center gap-2'>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className='border border-obsidian-border bg-obsidian-surface p-2 text-metallic-titanium hover:text-white'
            aria-label='Toggle navigation menu'
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
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
            <span className='h-2 w-2 rounded-full bg-crimson animate-ping' />
            Sportsbook Live
          </NavLink>
          <div className='mt-2 pt-3 border-t border-obsidian-border flex items-center justify-between'>
            <div className='font-mono text-xs text-gold-specular'>$1,450.00 USD</div>
            <button className='border-brutal-crimson bg-crimson px-3 py-1 font-display text-xs font-bold text-white uppercase'>
              Depositar
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
