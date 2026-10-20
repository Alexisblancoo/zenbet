import { NavLink } from 'react-router-dom';
import { 
  Swords, 
  Flame, 
  Trophy, 
  Activity, 
  Zap, 
  Sparkles,
  ChevronRight,
  Wallet
} from 'lucide-react';

const SPORTS_CATEGORIES = [
  { id: 'mma', name: 'UFC / MMA', icon: Swords, path: '/sportsbook', liveCount: 2, isHot: true },
  { id: 'soccer', name: 'Fútbol', icon: Trophy, path: '/sportsbook', liveCount: 14, isHot: false },
  { id: 'basketball', name: 'Baloncesto', icon: Activity, path: '/sportsbook', liveCount: 5, isHot: false },
  { id: 'boxing', name: 'Boxeo Mundial', icon: Zap, path: '/sportsbook', liveCount: 1, isHot: false },
  { id: 'esports', name: 'eSports CS2/LoL', icon: Sparkles, path: '/sportsbook', liveCount: 4, isHot: false },
];

export default function Sidebar() {
  return (
    <aside className='hidden lg:flex w-64 flex-col shrink-0 border-r border-obsidian-border bg-obsidian-surface/60 backdrop-blur-md min-h-[calc(100vh-4rem)] p-4 select-none'>
      {/* Título de sección */}
      <div className='mb-3 flex items-center justify-between'>
        <span className='font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
          Cartelera Deportiva
        </span>
        <span className='relative flex h-2 w-2'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-crimson' />
        </span>
      </div>

      {/* Lista de deportes */}
      <nav className='flex flex-col gap-1.5'>
        {SPORTS_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <NavLink
              key={cat.id}
              to={cat.path}
              className={({ isActive }) =>
                `group flex items-center justify-between px-3 py-2.5 border transition-all duration-150 ${
                  cat.id === 'mma' && isActive
                    ? 'border-crimson bg-crimson/10 text-white shadow-brutal-crimson-sm'
                    : 'border-transparent text-metallic-titanium hover:border-obsidian-border hover:bg-obsidian-elevated hover:text-white'
                }`
              }
            >
              <div className='flex items-center gap-2.5'>
                <Icon
                  size={15}
                  className={
                    cat.isHot
                      ? 'text-crimson'
                      : 'text-metallic-titanium group-hover:text-white'
                  }
                />
                <span className='font-display text-xs font-bold uppercase tracking-wider'>
                  {cat.name}
                </span>
              </div>

              {cat.liveCount > 0 && (
                <span
                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${
                    cat.isHot
                      ? 'border-crimson/40 bg-crimson/20 text-crimson'
                      : 'border-obsidian-border bg-obsidian text-metallic-titanium'
                  }`}
                >
                  {cat.liveCount} LIVE
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className='my-5 h-px bg-obsidian-border' />

      {/* Herramientas y Acciones */}
      <div className='mb-3'>
        <span className='font-mono text-[10px] font-bold uppercase tracking-ultra text-metallic-titanium'>
          Herramientas
        </span>
      </div>

      <div className='flex flex-col gap-1.5'>
        <NavLink
          to='/wallet'
          className={({ isActive }) =>
            `flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-wider border transition-colors ${
              isActive
                ? 'border-gold/40 bg-gold/5 text-gold-specular'
                : 'border-transparent text-metallic-titanium hover:text-white hover:bg-obsidian-elevated hover:border-obsidian-border'
            }`
          }
        >
          <span className='flex items-center gap-2'>
            <Wallet size={13} className='text-gold-imperial' />
            Mi Billetera
          </span>
          <ChevronRight size={14} />
        </NavLink>
        <NavLink
          to='/sportsbook'
          className='flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-wider text-metallic-titanium hover:text-white hover:bg-obsidian-elevated border border-transparent hover:border-obsidian-border transition-colors'
        >
          <span>Boleto Rápido</span>
          <ChevronRight size={14} />
        </NavLink>
        <NavLink
          to='/example'
          className='flex items-center justify-between px-3 py-2 text-xs font-mono uppercase tracking-wider text-metallic-titanium hover:text-white hover:bg-obsidian-elevated border border-transparent hover:border-obsidian-border transition-colors'
        >
          <span>Estadísticas</span>
          <ChevronRight size={14} />
        </NavLink>
      </div>

      {/* Tarjeta de Boost Imperial al fondo */}
      <div className='mt-auto pt-6'>
        <div className='border-brutal-gold p-3.5 bg-obsidian-card relative overflow-hidden'>
          <div className='flex items-center gap-2 text-gold-imperial mb-1'>
            <Flame size={14} />
            <span className='font-display text-[11px] font-extrabold uppercase tracking-wider'>
              Zenbet Imperial Boost
            </span>
          </div>
          <p className='font-sans text-[11px] text-metallic-titanium leading-relaxed'>
            Combina 3 o más combates estelares y recibe hasta <span className='text-gold-specular font-bold'>+25%</span> de ganancia extra.
          </p>
          <div className='mt-2.5 flex items-center justify-between'>
            <span className='font-mono text-[9px] uppercase tracking-ultra text-metallic-slate'>
              Automático en boleto
            </span>
            <span className='font-mono text-xs font-bold text-gold-imperial'>VIP</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
