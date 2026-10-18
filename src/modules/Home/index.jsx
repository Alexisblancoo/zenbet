import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Swords, 
  Flame, 
  Zap, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Clock, 
  TrendingUp,
  Sparkles
} from 'lucide-react';

const FEATURED_COMBATS = [
  {
    id: 'ufc-312-du-plessis-strickland',
    title: 'UFC 312: Du Plessis vs. Strickland 2',
    status: 'live',
    weightClass: 'Peso Mediano (84 kg)',
    rounds: '5 asaltos · Round 3',
    fighter1: { name: 'Dricus du Plessis', record: '23-2-0', country: 'Sudáfrica', odds: 1.85 },
    fighter2: { name: 'Sean Strickland', record: '29-6-0', country: 'EE. UU.', odds: 1.95 },
  },
  {
    id: 'ufc-fn-makhachev-tsarukyan',
    title: 'UFC Fight Night: Makhachev vs. Tsarukyan',
    status: 'live',
    weightClass: 'Peso Ligero (70 kg)',
    rounds: '5 asaltos · En Pausa',
    fighter1: { name: 'Islam Makhachev', record: '27-1-0', country: 'Rusia', odds: 1.45 },
    fighter2: { name: 'Arman Tsarukyan', record: '22-3-0', country: 'Armenia', odds: 2.70 },
  },
  {
    id: 'ufc-313-pereira-ankalaev',
    title: 'UFC 313: Pereira vs. Ankalaev',
    status: 'scheduled',
    weightClass: 'Peso Semipesado (93 kg)',
    rounds: '5 asaltos · 22:00 UTC',
    fighter1: { name: 'Alex Pereira', record: '12-2-0', country: 'Brasil', odds: 1.72 },
    fighter2: { name: 'Magomed Ankalaev', record: '21-1-1', country: 'Rusia', odds: 2.10 },
  },
  {
    id: 'ufc-313-adesanya-imavov',
    title: 'UFC 313 Co-Estelar: Adesanya vs. Imavov',
    status: 'scheduled',
    weightClass: 'Peso Mediano (84 kg)',
    rounds: '3 asaltos · 20:30 UTC',
    fighter1: { name: 'Israel Adesanya', record: '24-4-0', country: 'Nigeria', odds: 1.65 },
    fighter2: { name: 'Nassourdine Imavov', record: '16-4-0', country: 'Francia', odds: 2.25 },
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('mma');

  const goToSportsbook = () => {
    navigate('/sportsbook');
  };

  return (
    <div className='flex flex-col w-full min-h-full bg-obsidian-void text-slate-100'>
      {/* 1. TICKER SUPERIOR DE RESULTADOS & CUOTAS EN VIVO */}
      <div className='w-full border-b border-obsidian-border bg-obsidian-surface/80 py-2 overflow-hidden select-none'>
        <div className='flex items-center gap-8 animate-marquee whitespace-nowrap text-xs font-mono text-metallic-titanium'>
          <span className='flex items-center gap-2'>
            <span className='h-2 w-2 rounded-full bg-crimson animate-ping' />
            <strong className='text-white uppercase'>EN VIVO:</strong> UFC 312 Du Plessis (1.85) vs Strickland (1.95) · Round 3
          </span>
          <span className='text-metallic-slate'>|</span>
          <span className='flex items-center gap-2'>
            <span className='h-2 w-2 rounded-full bg-crimson animate-ping' />
            <strong className='text-white uppercase'>EN VIVO:</strong> Makhachev (1.45) vs Tsarukyan (2.70)
          </span>
          <span className='text-metallic-slate'>|</span>
          <span className='flex items-center gap-2 text-gold-imperial'>
            <Flame size={13} />
            <strong>BOOST ORO IMPERIAL:</strong> Parlay x6.50 disponible en UFC 313
          </span>
          <span className='text-metallic-slate'>|</span>
          <span className='text-metallic-chrome'>
            PRÓXIMO: Alex Pereira (1.72) vs Magomed Ankalaev (2.10)
          </span>
          <span className='text-metallic-slate'>|</span>
          <span className='text-emerald-400 font-bold'>
            LIQUIDACIÓN INSTANTÁNEA ACTIVA
          </span>
        </div>
      </div>

      <div className='mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-10'>
        {/* 2. HERO PRINCIPAL BRUTALISTA MONOLÍTICO */}
        <section className='border-brutal-cold relative overflow-hidden bg-gradient-obsidian-radial p-6 sm:p-10'>
          {/* Luz difusa ambiental carmesí */}
          <div className='pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-crimson/15 blur-3xl' />
          <div className='pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-gold-imperial/10 blur-3xl' />

          <div className='relative z-10 flex flex-col gap-6'>
            {/* Tag técnico de estado */}
            <div className='flex flex-wrap items-center gap-3'>
              <div className='flex items-center gap-2 border border-crimson/60 bg-crimson/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-ultra text-crimson shadow-brutal-crimson-sm'>
                <span className='h-2 w-2 rounded-full bg-crimson animate-ping' />
                Evento Estelar en Disputa
              </div>
              <span className='font-mono text-xs text-metallic-titanium'>
                UFC 312 · T-Mobile Arena, Las Vegas
              </span>
            </div>

            {/* Titular Titánico */}
            <div className='max-w-4xl'>
              <h1 className='font-display text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tightest text-white leading-none'>
                DU PLESSIS <span className='text-crimson'>vs</span> STRICKLAND 2
              </h1>
              <p className='mt-4 font-sans text-sm sm:text-base text-metallic-platinum max-w-2xl leading-relaxed'>
                La revancha más anticipada del año por el Campeonato Mundial de Peso Mediano. Cuotas Moneyline actualizadas segundo a segundo con motor de baja latencia.
              </p>
            </div>

            {/* Cara a Cara de Cuotas Rápidas */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl'>
              {/* Peleador 1 */}
              <div 
                onClick={goToSportsbook}
                className='border border-obsidian-border bg-obsidian-surface p-4 flex items-center justify-between cursor-pointer hover:border-crimson hover:bg-obsidian-elevated transition-all duration-200 group'
              >
                <div>
                  <span className='font-mono text-[10px] text-metallic-titanium uppercase tracking-ultra'>Sudáfrica · 23-2-0</span>
                  <h3 className='font-display text-base font-extrabold uppercase text-white group-hover:text-crimson transition-colors'>
                    Dricus du Plessis
                  </h3>
                  <span className='font-mono text-xs text-emerald-400'>Campeón Defensor</span>
                </div>
                <div className='border-brutal-crimson bg-crimson/20 px-3 py-2 text-right'>
                  <span className='font-mono text-[10px] block text-metallic-titanium uppercase'>Cuota</span>
                  <span className='font-mono text-xl font-black text-white'>1.85</span>
                </div>
              </div>

              {/* Peleador 2 */}
              <div 
                onClick={goToSportsbook}
                className='border border-obsidian-border bg-obsidian-surface p-4 flex items-center justify-between cursor-pointer hover:border-crimson hover:bg-obsidian-elevated transition-all duration-200 group'
              >
                <div>
                  <span className='font-mono text-[10px] text-metallic-titanium uppercase tracking-ultra'>EE. UU. · 29-6-0</span>
                  <h3 className='font-display text-base font-extrabold uppercase text-white group-hover:text-crimson transition-colors'>
                    Sean Strickland
                  </h3>
                  <span className='font-mono text-xs text-metallic-titanium'>Retador #1</span>
                </div>
                <div className='border border-obsidian-border bg-obsidian px-3 py-2 text-right group-hover:border-crimson transition-colors'>
                  <span className='font-mono text-[10px] block text-metallic-titanium uppercase'>Cuota</span>
                  <span className='font-mono text-xl font-black text-white'>1.95</span>
                </div>
              </div>
            </div>

            {/* Botones de Acción Hero */}
            <div className='flex flex-wrap items-center gap-4 pt-2'>
              <Link
                to='/sportsbook'
                className='border-brutal-crimson bg-crimson px-6 py-3 font-display text-sm font-extrabold uppercase tracking-wider text-white shadow-brutal-crimson transition-all hover:bg-crimson-pure hover:scale-[1.02] active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-3'
              >
                <Swords size={18} />
                <span>Entrar al Sportsbook Completo</span>
                <ArrowRight size={18} />
              </Link>

              <button
                onClick={goToSportsbook}
                className='border border-obsidian-border bg-obsidian-surface px-5 py-3 font-display text-xs font-bold uppercase tracking-wider text-metallic-chrome hover:border-metallic-titanium hover:text-white transition-all flex items-center gap-2'
              >
                <Activity size={16} className='text-crimson' />
                <span>Ver Cartelera Completa (6 Combates)</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. BARRA DE FILTRO RÁPIDO DE DEPORTES */}
        <div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none'>
          {[
            { id: 'mma', name: 'UFC & MMA', count: 6, hot: true },
            { id: 'soccer', name: 'Fútbol Internacional', count: 18, hot: false },
            { id: 'basketball', name: 'Baloncesto NBA', count: 7, hot: false },
            { id: 'boxing', name: 'Boxeo Mundial', count: 3, hot: false },
            { id: 'esports', name: 'eSports CS2 / LoL', count: 5, hot: false },
          ].map((sport) => (
            <button
              key={sport.id}
              onClick={() => setActiveCategory(sport.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-display font-bold uppercase tracking-wider border transition-all ${
                activeCategory === sport.id
                  ? 'border-crimson bg-crimson/10 text-white shadow-brutal-crimson-sm'
                  : 'border-obsidian-border bg-obsidian-surface text-metallic-titanium hover:text-white hover:border-obsidian-border'
              }`}
            >
              <span>{sport.name}</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.2 border ${
                sport.hot ? 'border-crimson/40 bg-crimson/20 text-crimson' : 'border-obsidian-border bg-obsidian text-metallic-titanium'
              }`}>
                {sport.count}
              </span>
            </button>
          ))}
        </div>

        {/* 4. CARTELERA DESTACADA CON CUOTAS EN VIVO */}
        <section className='flex flex-col gap-4'>
          <div className='flex items-center justify-between border-b border-obsidian-border pb-3'>
            <div className='flex items-center gap-3'>
              <span className='h-2.5 w-2.5 bg-crimson' />
              <h2 className='font-display text-lg font-black uppercase tracking-wider text-white'>
                Combates Destacados en Vivo y Próximos
              </h2>
            </div>
            <Link
              to='/sportsbook'
              className='font-mono text-xs uppercase tracking-wider text-crimson hover:underline flex items-center gap-1.5'
            >
              <span>Ver todas las cuotas</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {FEATURED_COMBATS.map((combat) => {
              const isLive = combat.status === 'live';
              return (
                <div
                  key={combat.id}
                  className={`border p-5 bg-obsidian-surface flex flex-col justify-between gap-4 transition-all hover:border-metallic-titanium ${
                    isLive ? 'border-obsidian-border' : 'border-obsidian-border/60'
                  }`}
                >
                  {/* Encabezado del Combate */}
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      {isLive ? (
                        <span className='flex items-center gap-1.5 border border-crimson/50 bg-crimson/10 px-2 py-0.5 font-mono text-[10px] font-bold text-crimson uppercase'>
                          <span className='h-1.5 w-1.5 rounded-full bg-crimson animate-ping' />
                          En Vivo
                        </span>
                      ) : (
                        <span className='flex items-center gap-1 border border-obsidian-border bg-obsidian px-2 py-0.5 font-mono text-[10px] text-metallic-titanium uppercase'>
                          <Clock size={11} />
                          Programado
                        </span>
                      )}
                      <span className='font-mono text-xs text-metallic-slate'>
                        {combat.weightClass}
                      </span>
                    </div>
                    <span className='font-mono text-[11px] text-metallic-titanium'>
                      {combat.rounds}
                    </span>
                  </div>

                  {/* Nombre del Evento */}
                  <h3 className='font-display text-sm font-extrabold uppercase text-white tracking-wide'>
                    {combat.title}
                  </h3>

                  {/* Fila de Cuotas Moneyline */}
                  <div className='grid grid-cols-2 gap-3 pt-2'>
                    {/* Peleador 1 */}
                    <button
                      onClick={goToSportsbook}
                      className='border border-obsidian-border bg-obsidian-void p-3 flex flex-col text-left hover:border-crimson hover:bg-crimson/5 transition-all group'
                    >
                      <span className='font-mono text-[10px] text-metallic-slate truncate'>
                        {combat.fighter1.country} · {combat.fighter1.record}
                      </span>
                      <span className='font-display text-xs font-bold uppercase text-white truncate group-hover:text-crimson'>
                        {combat.fighter1.name}
                      </span>
                      <div className='mt-2 flex items-center justify-between border-t border-obsidian-border pt-1.5'>
                        <span className='font-mono text-[10px] text-metallic-titanium uppercase'>Moneyline</span>
                        <span className='font-mono text-sm font-black text-white group-hover:text-crimson'>
                          {combat.fighter1.odds.toFixed(2)}
                        </span>
                      </div>
                    </button>

                    {/* Peleador 2 */}
                    <button
                      onClick={goToSportsbook}
                      className='border border-obsidian-border bg-obsidian-void p-3 flex flex-col text-left hover:border-crimson hover:bg-crimson/5 transition-all group'
                    >
                      <span className='font-mono text-[10px] text-metallic-slate truncate'>
                        {combat.fighter2.country} · {combat.fighter2.record}
                      </span>
                      <span className='font-display text-xs font-bold uppercase text-white truncate group-hover:text-crimson'>
                        {combat.fighter2.name}
                      </span>
                      <div className='mt-2 flex items-center justify-between border-t border-obsidian-border pt-1.5'>
                        <span className='font-mono text-[10px] text-metallic-titanium uppercase'>Moneyline</span>
                        <span className='font-mono text-sm font-black text-white group-hover:text-crimson'>
                          {combat.fighter2.odds.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. BOOST IMPERIAL VIP (ORO IMPERIAL) */}
        <section className='border-brutal-gold bg-obsidian-surface p-6 sm:p-8 relative overflow-hidden'>
          <div className='relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6'>
            <div className='max-w-xl'>
              <div className='flex items-center gap-2 text-gold-imperial font-mono text-xs font-bold uppercase tracking-ultra mb-2'>
                <Flame size={16} />
                <span>Multiplicador Destacado del Día</span>
              </div>
              <h2 className='font-display text-2xl sm:text-3xl font-black uppercase text-white tracking-tightest'>
                TRIPLE PARLAY ESTELAR DE CAMPEONES
              </h2>
              <p className='mt-2 font-sans text-xs sm:text-sm text-metallic-platinum leading-relaxed'>
                Dricus du Plessis (1.85) + Islam Makhachev (1.45) + Alex Pereira (1.72).
                Cuota estándar de 4.61 elevada automáticamente a cuota VIP con garantía de ganancia máxima.
              </p>

              <div className='mt-4 flex items-center gap-6 font-mono text-xs'>
                <div>
                  <span className='block text-metallic-slate text-[10px] uppercase'>Cuota Base</span>
                  <span className='text-metallic-titanium line-through font-bold'>4.61</span>
                </div>
                <div>
                  <span className='block text-gold-imperial text-[10px] uppercase font-bold'>Cuota Boost VIP</span>
                  <span className='text-gold-specular font-black text-xl'>6.50</span>
                </div>
                <div>
                  <span className='block text-emerald-400 text-[10px] uppercase'>Ganancia Extra</span>
                  <span className='text-emerald-400 font-bold'>+41.0%</span>
                </div>
              </div>
            </div>

            <div className='flex flex-col gap-3 w-full md:w-auto shrink-0'>
              <button
                onClick={goToSportsbook}
                className='border-brutal-gold bg-gold-imperial px-6 py-3.5 font-display text-sm font-extrabold uppercase tracking-wider text-obsidian-abyss shadow-brutal-gold transition-all hover:bg-gold-bright hover:scale-[1.02] active:translate-x-0.5 active:translate-y-0.5 flex items-center justify-center gap-2'
              >
                <Sparkles size={16} />
                <span>Apostar al Parlay 6.50</span>
              </button>
              <span className='font-mono text-[10px] text-center text-metallic-slate uppercase'>
                Monto máximo: $500.00 USD · Bono Instantáneo
              </span>
            </div>
          </div>
        </section>

        {/* 6. PILARES TECNOLÓGICOS ZENBET */}
        <section className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
          <div className='border border-obsidian-border bg-obsidian-surface p-5 flex flex-col gap-2'>
            <div className='flex items-center gap-2 text-crimson font-mono text-xs font-bold uppercase'>
              <Zap size={16} />
              <span>Baja Latencia (12ms)</span>
            </div>
            <p className='font-sans text-xs text-metallic-titanium leading-relaxed'>
              Transmisión de cuotas en vivo por WebSockets deterministas sin desfases ni congelamiento de cuotas.
            </p>
          </div>

          <div className='border border-obsidian-border bg-obsidian-surface p-5 flex flex-col gap-2'>
            <div className='flex items-center gap-2 text-gold-imperial font-mono text-xs font-bold uppercase'>
              <ShieldCheck size={16} />
              <span>Liquidación Inmediata</span>
            </div>
            <p className='font-sans text-xs text-metallic-titanium leading-relaxed'>
              Al confirmarse el resultado oficial por la comisión atlética, tus ganancias se acreditan al instante en tu balance.
            </p>
          </div>

          <div className='border border-obsidian-border bg-obsidian-surface p-5 flex flex-col gap-2'>
            <div className='flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase'>
              <TrendingUp size={16} />
              <span>Mejor Margen de la Industria</span>
            </div>
            <p className='font-sans text-xs text-metallic-titanium leading-relaxed'>
              Margen de casa reducido al mínimo brutalista (vig &lt; 2.5%), otorgándote el mayor valor por cada dólar apostado.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
