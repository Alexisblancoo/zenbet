import type { ReactNode } from 'react';
import { CheckCircle2, ShieldCheck, Ticket, Wallet } from 'lucide-react';

import type { AuthMode } from '@/context/authModalState';
import { useUfcEvents } from '@/hooks/useUfcEvents';

interface AuthPageLayoutProps {
  readonly mode: AuthMode;
  readonly children: ReactNode;
}

const BENEFITS = [
  {
    icon: Wallet,
    title: 'Billetera propia',
    description: 'Recarga y revisa tus movimientos cuando quieras apostar.',
    accent: 'text-money',
    border: 'border-money/25 bg-money/[0.035]',
  },
  {
    icon: Ticket,
    title: 'Boleto siempre a mano',
    description: 'Selecciona cuotas y confirma desde cualquier pantalla.',
    accent: 'text-crimson',
    border: 'border-white/[0.08] bg-white/[0.02]',
  },
  {
    icon: ShieldCheck,
    title: 'Sesión protegida',
    description: 'Contraseña cifrada y acceso personal a tu billetera.',
    accent: 'text-sage',
    border: 'border-white/[0.08] bg-white/[0.02]',
  },
] as const;

export default function AuthPageLayout({ mode, children }: AuthPageLayoutProps) {
  const isRegister = mode === 'register';
  const { events, isLoading } = useUfcEvents();
  const fmt = (n: number) => (isLoading || events.length === 0 ? '—' : String(n));
  const marketCount = events.reduce((sum, e) => sum + e.markets.length, 0);
  const oddsCount = events.reduce(
    (sum, e) => sum + e.markets.reduce((acc, m) => acc + m.selections.length, 0),
    0,
  );

  return (
    <div className='relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0D0D0D]'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute -left-32 top-8 h-72 w-72 rounded-full bg-crimson/[0.08] blur-3xl'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sage/[0.06] blur-3xl'
      />

      <div className='relative mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(430px,520px)] lg:gap-12 lg:px-8 lg:py-12'>
        <section className='hidden min-w-0 lg:block' aria-label='Información de ZenBet'>
          <div className='flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-crimson'>
            <span className='h-1.5 w-1.5 bg-crimson' aria-hidden='true' />
            UFC · Shibuya Night
          </div>

          <h1 className='mt-5 max-w-[12ch] font-display text-[46px] font-bold leading-[0.98] tracking-[-0.05em] text-white xl:text-[54px]'>
            {isRegister ? 'Toda la cartelera. Un solo boleto.' : 'Vuelve a la cartelera.'}
          </h1>

          <p className='mt-5 max-w-[44ch] text-sm leading-relaxed text-metallic-titanium'>
            {isRegister
              ? 'Abre tu cuenta y entra a las próximas carteleras UFC con la procedencia de cada cuota siempre visible.'
              : 'Tu billetera, tus selecciones y el pulso de las próximas carteleras UFC te esperan. Entra para continuar donde lo dejaste.'}
          </p>

          <div className='mt-7 grid grid-cols-3 divide-x divide-white/[0.08] border-y border-white/[0.08]'>
            <div className='pr-4'>
              <p className='font-display text-xl font-bold tabular-nums text-white'>{fmt(events.length)}</p>
              <p className='mt-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                Combates
              </p>
            </div>
            <div className='px-4'>
              <p className='font-display text-xl font-bold tabular-nums text-white'>{fmt(marketCount)}</p>
              <p className='mt-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                Mercados
              </p>
            </div>
            <div className='pl-4'>
              <p className='font-display text-xl font-bold tabular-nums text-money'>{fmt(oddsCount)}</p>
              <p className='mt-1 font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
                Cuotas
              </p>
            </div>
          </div>

          <ul className='mt-7 space-y-2.5'>
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <li
                  key={benefit.title}
                  className={`flex items-start gap-3 border p-3.5 ${benefit.border}`}
                >
                  <span className={`mt-0.5 shrink-0 ${benefit.accent}`}>
                    <Icon size={16} aria-hidden='true' />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-[12px] font-semibold text-white'>{benefit.title}</p>
                    <p className='mt-0.5 text-[11px] leading-relaxed text-metallic-slate'>
                      {benefit.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className='mt-7 flex items-center gap-2 text-[10px] text-metallic-slate'>
            <CheckCircle2 size={12} className='text-sage' aria-hidden='true' />
            Cuotas de referencia con <span className='text-sage'>procedencia declarada</span>.
          </div>
        </section>

        <div className='mx-auto min-w-0 w-full max-w-xl lg:max-w-none'>{children}</div>
      </div>
    </div>
  );
}
