import { useMemo } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  Radio,
  ShieldCheck,
  Sparkles,
  Swords,
  Ticket,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react';

import {
  buildUfcCards,
  cardCity,
  findUfcCard,
  formatCardDayBadge,
  formatFightDay,
  shortFighterName,
  ufcCardNumber,
} from '@/domain/ufc';
import { useUfcEvents } from '@/hooks/useUfcEvents';

const SPORTS_CATEGORIES = [
  {
    id: 'mma',
    name: 'UFC / MMA',
    icon: Swords,
    path: '/sportsbook',
    tag: 'UFC',
    available: true,
    isHot: true,
  },
  {
    id: 'soccer',
    name: 'Fútbol',
    icon: Trophy,
    tag: 'Pronto',
    available: false,
    isHot: false,
  },
  {
    id: 'basketball',
    name: 'Baloncesto',
    icon: Activity,
    tag: 'Pronto',
    available: false,
    isHot: false,
  },
  {
    id: 'boxing',
    name: 'Boxeo',
    icon: Zap,
    tag: 'Pronto',
    available: false,
    isHot: false,
  },
  {
    id: 'esports',
    name: 'eSports',
    icon: Sparkles,
    tag: 'Pronto',
    available: false,
    isHot: false,
  },
];

const TOOL_LINKS = [
  { label: 'Mi billetera', path: '/wallet', icon: Wallet, tone: 'text-money' },
  { label: 'Boleto rápido', path: '/sportsbook', icon: Ticket, tone: 'text-crimson' },
  { label: 'Estadísticas', path: '/example', icon: Activity, tone: 'text-electric-soft' },
];

export default function Sidebar() {
  const { events, isLoading, error } = useUfcEvents();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const cards = useMemo(() => buildUfcCards(events), [events]);
  const requestedCard = findUfcCard(cards, searchParams.get('card'));
  const onSportsbook = location.pathname.startsWith('/sportsbook');
  const activeKey = onSportsbook ? requestedCard?.key ?? null : null;
  const featuredCard = requestedCard ?? cards[0];
  const featuredMainEvent = featuredCard?.mainEvent;
  const cardNumber = featuredCard
    ? ufcCardNumber(featuredCard.competition) ?? 'MMA'
    : 'MMA';
  const totalMarkets = events.reduce((count, event) => count + event.markets.length, 0);

  return (
    <aside className='no-scrollbar sticky top-16 hidden h-[calc(100vh-4rem)] w-[224px] shrink-0 self-start overflow-y-auto border-r border-white/[0.08] bg-[#07090E]/94 backdrop-blur-xl lg:flex lg:flex-col'>
      <div className='px-3 pb-3 pt-4'>
        <div className='flex items-center justify-between'>
          <span className='shibuya-kicker text-metallic-slate'>Sportsbook</span>
          <span className='inline-flex items-center gap-1 border border-electric/30 bg-electric/[0.07] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide text-electric-soft'>
            <span className='h-1 w-1 bg-electric' aria-hidden='true' />
            24H
          </span>
        </div>

        <div className='mt-3 flex items-center gap-2.5 border border-white/[0.06] bg-white/[0.02] p-2'>
          <span className='grid h-8 w-8 shrink-0 place-items-center border border-crimson/35 bg-crimson/10 font-display text-[9px] font-black text-crimson'>
            UFC
          </span>
          <div className='min-w-0'>
            <p className='font-display text-[11px] font-bold uppercase leading-tight tracking-wide text-white'>
              Artes marciales
            </p>
            <p className='mt-0.5 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              {isLoading
                ? 'Cargando carteleras'
                : `${events.length} combates · ${totalMarkets} mercados`}
            </p>
          </div>
        </div>
      </div>

      <div className='px-3'>
        <p className='shibuya-kicker mb-2 text-metallic-slate'>Deportes</p>
        <nav aria-label='Deportes' className='flex flex-col gap-0.5'>
          {SPORTS_CATEGORIES.map((category) => {
            const Icon = category.icon;

            if (!category.available) {
              return (
                <div
                  key={category.id}
                  aria-disabled='true'
                  className='flex items-center justify-between gap-2 border border-transparent px-2.5 py-1.5 text-metallic-gunmetal opacity-55'
                >
                  <span className='flex min-w-0 items-center gap-2'>
                    <Icon size={13} className='shrink-0' aria-hidden='true' />
                    <span className='truncate font-display text-[10px] font-bold uppercase tracking-wide'>
                      {category.name}
                    </span>
                  </span>
                  <span className='shrink-0 font-mono text-[8px] uppercase tracking-wide'>
                    {category.tag}
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={category.id}
                to={category.path}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between gap-2 border px-2.5 py-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson ${
                    isActive
                      ? 'shibuya-rail-active border-white/[0.06] text-white'
                      : 'border-transparent text-metallic-titanium hover:border-white/[0.05] hover:bg-white/[0.025] hover:text-white'
                  }`
                }
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <Icon
                    size={14}
                    className={category.isHot ? 'shrink-0 text-crimson' : 'shrink-0'}
                    aria-hidden='true'
                  />
                  <span className='truncate font-display text-[10px] font-bold uppercase tracking-wide'>
                    {category.name}
                  </span>
                </span>
                <span
                  className={`shrink-0 border px-1 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${
                    category.isHot
                      ? 'border-crimson/35 bg-crimson/10 text-crimson'
                      : 'border-white/[0.06] bg-white/[0.02] text-metallic-slate'
                  }`}
                >
                  {category.tag}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className='mx-3 my-3 h-px bg-linear-to-r from-transparent via-white/[0.09] to-transparent' />

      <div className='px-3'>
        <div className='mb-2 flex items-center justify-between'>
          <p className='shibuya-kicker text-metallic-slate'>Carteleras</p>
          <Radio size={10} className='text-crimson/70' aria-hidden='true' />
        </div>
        <div className='flex flex-col gap-0.5'>
          {isLoading && cards.length === 0 && (
            <p className='px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
              Leyendo sábados…
            </p>
          )}

          {!isLoading && error && (
            <p className='px-2.5 py-1.5 font-mono text-[9px] uppercase leading-relaxed tracking-wide text-crimson/80'>
              Carteleras no disponibles
            </p>
          )}

          {cards.map((card) => {
            const active = activeKey === card.key;
            const number = ufcCardNumber(card.competition);

            return (
              <Link
                key={card.key}
                to={`/sportsbook?card=${card.key}`}
                title={`${card.competition} · ${formatFightDay(card.startTime)}`}
                aria-current={active ? 'page' : undefined}
                className={`group flex items-center justify-between gap-2 border px-2.5 py-1.5 transition-colors duration-150 ${
                  active
                    ? 'border-crimson/25 bg-crimson/[0.06]'
                    : 'border-transparent hover:border-white/[0.05] hover:bg-white/[0.02]'
                }`}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <span
                    className={`h-1 w-1 shrink-0 ${active ? 'bg-crimson' : 'bg-metallic-gunmetal'}`}
                    aria-hidden='true'
                  />
                  <span className='min-w-0'>
                    <span
                      className={`block truncate font-sans text-[10px] uppercase tracking-wide ${
                        active ? 'font-semibold text-white' : 'text-metallic-titanium'
                      }`}
                    >
                      <span className='text-metallic-slate'>
                        {formatCardDayBadge(card.startTime)} ·{' '}
                      </span>
                      {number ? `UFC ${number}` : 'UFC FN'}
                    </span>
                    <span className='mt-0.5 block truncate font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                      {shortFighterName(card.mainEvent.bout.red.name)} vs{' '}
                      {shortFighterName(card.mainEvent.bout.blue.name)}
                    </span>
                  </span>
                </span>
                <span className='shrink-0 font-mono text-[8px] tabular-nums text-metallic-slate'>
                  {card.events.length}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className='mx-3 my-3 h-px bg-linear-to-r from-transparent via-white/[0.09] to-transparent' />

      <div className='px-3'>
        <p className='shibuya-kicker mb-2 text-metallic-slate'>Herramientas</p>
        <nav aria-label='Herramientas' className='flex flex-col gap-0.5'>
          {TOOL_LINKS.map((tool) => {
            const Icon = tool.icon;
            const isSlipTool = tool.label === 'Boleto rápido';

            return (
              <NavLink
                key={tool.label}
                to={tool.path}
                className={({ isActive }) =>
                  `group flex items-center justify-between gap-2 border border-transparent px-2.5 py-2 transition-colors duration-150 ${
                    !isSlipTool && isActive
                      ? 'border-white/[0.06] bg-white/[0.025] text-white'
                      : 'text-metallic-titanium hover:border-white/[0.05] hover:bg-white/[0.02] hover:text-white'
                  }`
                }
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <Icon size={13} className={`shrink-0 ${tool.tone}`} aria-hidden='true' />
                  <span className='truncate font-sans text-[10px] uppercase tracking-wide'>
                    {tool.label}
                  </span>
                </span>
                <ChevronRight size={11} className='shrink-0 text-metallic-slate' aria-hidden='true' />
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className='mt-auto p-3'>
        <div className='relative overflow-hidden border border-crimson/25 bg-linear-to-br from-crimson/[0.12] via-transparent to-electric/[0.05] p-3'>
          <span
            aria-hidden='true'
            className='pointer-events-none absolute -right-3 -top-4 font-display text-[64px] font-black leading-none text-white/[0.025]'
          >
            {cardNumber}
          </span>
          <p className='relative shibuya-kicker text-crimson'>Main event</p>
          <p className='relative mt-1 font-display text-[11px] font-bold uppercase leading-tight text-white'>
            <span className='block'>
              {featuredMainEvent
                ? shortFighterName(featuredMainEvent.bout.red.name)
                : 'Cartelera UFC'}
            </span>
            <span className='my-0.5 flex items-center gap-1.5 font-mono text-[8px] font-bold text-crimson'>
              <span className='h-px w-3 bg-crimson/50' aria-hidden='true' />
              vs
            </span>
            <span className='block'>
              {featuredMainEvent
                ? shortFighterName(featuredMainEvent.bout.blue.name)
                : 'Próximo sábado'}
            </span>
          </p>
          <p className='relative mt-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {featuredCard
              ? `${formatCardDayBadge(featuredCard.startTime)} · ${cardCity(featuredCard.location)}`
              : 'Carteleras por confirmar'}
          </p>
          <Link
            to={featuredCard ? `/sportsbook?card=${featuredCard.key}` : '/sportsbook'}
            className='relative mt-2.5 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wide text-crimson transition-colors hover:text-white'
          >
            Ver mercados
            <ChevronRight size={10} aria-hidden='true' />
          </Link>
        </div>

        <p className='mt-2 flex items-center gap-1.5 font-mono text-[8px] uppercase leading-relaxed tracking-wide text-metallic-slate'>
          <ShieldCheck size={9} className='shrink-0 text-electric-soft' aria-hidden='true' />
          Snapshot de fuentes · no ejecutable
        </p>
      </div>
    </aside>
  );
}
