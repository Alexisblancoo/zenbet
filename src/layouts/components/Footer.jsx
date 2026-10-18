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
              Motor monolítico de apuestas deportivas de alta frecuencia. Cotizaciones en tiempo real y liquidaciones instantáneas.
            </p>
            <div className='mt-4 flex items-center gap-3 font-mono text-[10px] text-metallic-slate'>
              <span className='border border-obsidian-border px-1.5 py-0.5 text-crimson font-bold'>+18</span>
              <span>JUEGO RESPONSABLE</span>
            </div>
          </div>

          {/* Columna Carteleras */}
          <div>
            <h3 className='font-mono text-[11px] font-bold uppercase tracking-ultra text-white'>
              Carteleras Live
            </h3>
            <ul className='mt-3 space-y-2 font-sans text-xs'>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  UFC 312: Du Plessis vs. Strickland 2
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  UFC Fight Night: Makhachev vs. Tsarukyan
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  UFC 313: Pereira vs. Ankalaev
                </Link>
              </li>
              <li>
                <Link to='/sportsbook' className='hover:text-crimson transition-colors'>
                  UFC 313: Adesanya vs. Imavov
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
                <span className='cursor-pointer hover:text-white transition-colors'>
                  Reglas de Apuesta Moneyline
                </span>
              </li>
              <li>
                <span className='cursor-pointer hover:text-white transition-colors'>
                  API de Cotizaciones en Vivo
                </span>
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
                <span>Cifrado TLS 256-bit de grado militar</span>
              </div>
              <div className='flex items-center gap-2'>
                <Zap size={14} className='text-crimson' />
                <span>Liquidación algorítmica instantánea</span>
              </div>
              <div className='flex items-center gap-2'>
                <ShieldCheck size={14} className='text-emerald-400' />
                <span>Cuotas transparentes sin spread abusivo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Separador */}
        <div className='my-8 h-px bg-obsidian-border' />

        {/* Barra inferior */}
        <div className='flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] text-metallic-slate'>
          <p>© 2026 Zenbet Interactive Ltd. Todos los derechos reservados.</p>
          <div className='flex items-center gap-4'>
            <span>TERMINAL V1.4</span>
            <span>·</span>
            <span>LATENCIA: 12MS</span>
            <span>·</span>
            <span className='text-emerald-400'>ONLINE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
