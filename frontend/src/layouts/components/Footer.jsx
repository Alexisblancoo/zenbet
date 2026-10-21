import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, Lock } from 'lucide-react';

export default function Footer() {
  return (
    <footer className='w-full border-t border-obsidian-border bg-obsidian-void text-metallic-titanium'>
      <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        {/* Fila principal de 4 columnas */}
        <div className='grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12'>
          {/* Columna Marca */}
          <div className='md:col-span-1'>
            <div className='flex items-center gap-2'>
              <div className='flex h-7 w-7 items-center justify-center border border-crimson/80 bg-crimson/10 font-display font-black text-crimson text-sm'>
                Z
              </div>
              <span className='font-display text-lg font-black tracking-tightest uppercase text-white'>
                ZENBET
              </span>
            </div>
            <p className='mt-3 font-sans text-xs text-metallic-titanium leading-relaxed'>
              Sportsbook de combate con cuotas decimales y americanas, mercados de UFC y un boleto
              conectado a una API con persistencia PostgreSQL.
            </p>
            <div className='mt-4 flex items-center gap-3 font-mono text-[10px] text-metallic-slate'>
              <span className='border border-obsidian-border px-1.5 py-0.5 text-crimson font-bold'>+18</span>
              <span>JUEGO RESPONSABLE</span>
            </div>
          </div>

          {/* Columna Carteleras */}
          <div>
            <h3 className='font-mono text-[11px] font-bold uppercase tracking-ultra text-white'>
              Cartelera
            </h3>
            <ul className='mt-3 space-y-2 font-sans text-xs'>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  UFC 333: Volkanovski vs. Evloev
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  Cartelera estelar · 5 combates
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  Preliminares · 4 combates
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  Preliminares tempranas · 5 combates
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna Plataforma */}
          <div>
            <h3 className='font-mono text-[11px] font-bold uppercase tracking-ultra text-white'>
              Plataforma
            </h3>
            <ul className='mt-3 space-y-2 font-sans text-xs'>
              <li>
                <Link to='/' className='hover:text-white transition-colors'>
                  Inicio y Portada
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-white transition-colors'>
                  Sportsbook de Combate
                </Link>
              </li>
              <li>
                <Link to='/terms' className='hover:text-white transition-colors'>
                  Reglas de Apuesta Moneyline
                </Link>
              </li>
              <li>
                <span>API de Cuotas v1</span>
              </li>
            </ul>
          </div>

          {/* Columna Seguridad & Cumplimiento */}
          <div>
            <h3 className='font-mono text-[11px] font-bold uppercase tracking-ultra text-white'>
              Garantía & Auditoría
            </h3>
            <div className='mt-3 space-y-2.5 font-sans text-xs'>
              <div className='flex items-center gap-2'>
                <Lock size={14} className='text-gold-imperial' />
                <span>Sesión autenticada con JWT</span>
              </div>
              <div className='flex items-center gap-2'>
                <Zap size={14} className='text-crimson' />
                <span>Persistencia PostgreSQL y migraciones EF Core</span>
              </div>
              <div className='flex items-center gap-2'>
                <ShieldCheck size={14} className='text-emerald-400' />
                <span>Proveedor de cuotas declarado por mercado</span>
              </div>
            </div>
            <div className='mt-4 flex flex-wrap gap-2 text-xs'>
              <Link to='/terms' className='text-metallic-platinum hover:text-crimson underline transition-colors'>
                Términos
              </Link>
              <span>·</span>
              <Link to='/privacy' className='text-metallic-platinum hover:text-crimson underline transition-colors'>
                Privacidad
              </Link>
              <span>·</span>
              <Link to='/refunds' className='text-metallic-platinum hover:text-crimson underline transition-colors'>
                Reembolsos
              </Link>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className='my-8 h-px bg-obsidian-border' />

        {/* Barra inferior */}
        <div className='flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-metallic-slate'>
          <div className='flex flex-wrap items-center gap-3'>
            <p>© 2026 Zenbet Interactive Ltd. Todos los derechos reservados.</p>
            <div className='flex items-center gap-2'>
              <Link to='/terms' className='hover:text-white transition-colors'>Términos</Link>
              <span>·</span>
              <Link to='/privacy' className='hover:text-white transition-colors'>Privacidad</Link>
              <span>·</span>
              <Link to='/refunds' className='hover:text-white transition-colors'>Reembolsos</Link>
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-4'>
            <span>API V1</span>
            <span>·</span>
            <span>POSTGRESQL</span>
            <span>·</span>
            <span className='text-metallic-titanium'>ZENBET</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
