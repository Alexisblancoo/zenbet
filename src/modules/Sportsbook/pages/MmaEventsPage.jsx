import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, Swords, X } from 'lucide-react';
import EventCard from '../components/EventCard';
import BetSlip from '../components/BetSlip';

/**
 * MmaEventsPage — Cartelera MMA con layout de dos columnas.
 *
 * Columna izquierda: listado de combates (en vivo primero) con cuotas Moneyline.
 * Columna derecha: boleto de apuestas sticky que sincroniza su estado con `selections`.
 *
 * Datos simulados: reemplazar `MOCK_EVENTS` por el feed real (services/apiClient.js
 * o el hook useOddsStream.js) manteniendo el mismo contrato `FightEvent`.
 */

const MONEY_FORMATTER = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' });

/* -------------------------------------------------------------------------- */
/* Datos simulados de la cartelera                                             */
/* -------------------------------------------------------------------------- */

const MOCK_EVENTS = [
  {
    id: 'ufc-312-du-plessis-strickland',
    title: 'UFC 312: Du Plessis vs. Strickland 2',
    status: 'live',
    weightClass: 'Peso Mediano',
    rounds: '5 asaltos',
    fighters: [
      { id: 'du-plessis', name: 'Dricus du Plessis', record: '23-2-0', country: 'Sudáfrica', odds: 1.85 },
      { id: 'strickland', name: 'Sean Strickland', record: '29-6-0', country: 'EE. UU.', odds: 1.95 },
    ],
  },
  {
    id: 'ufc-fn-makhachev-tsarukyan',
    title: 'UFC Fight Night: Makhachev vs. Tsarukyan',
    status: 'live',
    weightClass: 'Peso Ligero',
    rounds: '5 asaltos',
    fighters: [
      { id: 'makhachev', name: 'Islam Makhachev', record: '27-1-0', country: 'Rusia', odds: 1.45 },
      { id: 'tsarukyan', name: 'Arman Tsarukyan', record: '22-3-0', country: 'Armenia', odds: 2.70 },
    ],
  },
  {
    id: 'ufc-313-pereira-ankalaev',
    title: 'UFC 313: Pereira vs. Ankalaev',
    status: 'scheduled',
    startTime: '2026-10-17T22:00:00-06:00',
    weightClass: 'Peso Semipesado',
    rounds: '5 asaltos',
    fighters: [
      { id: 'pereira', name: 'Alex Pereira', record: '12-2-0', country: 'Brasil', odds: 1.72 },
      { id: 'ankalaev', name: 'Magomed Ankalaev', record: '21-1-1', country: 'Rusia', odds: 2.10 },
    ],
  },
  {
    id: 'ufc-313-adesanya-imavov',
    title: 'UFC 313 Co-Estelar: Adesanya vs. Imavov',
    status: 'scheduled',
    startTime: '2026-10-17T20:30:00-06:00',
    weightClass: 'Peso Mediano',
    rounds: '3 asaltos',
    fighters: [
      { id: 'adesanya', name: 'Israel Adesanya', record: '24-4-0', country: 'Nigeria', odds: 1.65 },
      { id: 'imavov', name: 'Nassourdine Imavov', record: '16-4-0', country: 'Francia', odds: 2.25 },
    ],
  },
  {
    id: 'ufc-fn-blanchfield-fiorot',
    title: 'UFC Fight Night: Blanchfield vs. Fiorot',
    status: 'scheduled',
    startTime: '2026-10-18T18:00:00-06:00',
    weightClass: 'Peso Mosca',
    rounds: '3 asaltos',
    fighters: [
      { id: 'blanchfield', name: 'Erin Blanchfield', record: '13-2-0', country: 'EE. UU.', odds: 2.05 },
      { id: 'fiorot', name: 'Manon Fiorot', record: '12-2-0', country: 'Francia', odds: 1.78 },
    ],
  },
  {
    id: 'ufc-fn-aspinall-gane',
    title: 'UFC Fight Night: Aspinall vs. Gane',
    status: 'scheduled',
    startTime: '2026-10-24T20:00:00-06:00',
    weightClass: 'Peso Completo',
    rounds: '5 asaltos',
    fighters: [
      { id: 'aspinall', name: 'Tom Aspinall', record: '15-3-0', country: 'Inglaterra', odds: 1.58 },
      { id: 'gane', name: 'Ciryl Gane', record: '13-2-0', country: 'Francia', odds: 2.40 },
    ],
  },
];

// Los combates en vivo encabezan la cartelera; el resto conserva el orden del programa.
const EVENTS = [...MOCK_EVENTS].sort((a, b) =>
  a.status === b.status ? 0 : a.status === 'live' ? -1 : 1,
);
const LIVE_EVENTS = EVENTS.filter((event) => event.status === 'live');
const SCHEDULED_EVENTS = EVENTS.filter((event) => event.status !== 'live');

/* -------------------------------------------------------------------------- */
/* UI auxiliar                                                                 */
/* -------------------------------------------------------------------------- */

/** Encabezado técnico de sección con contador y línea de separación. */
function SectionHeading({ id, label, count, live = false }) {
  return (
    <div className='flex items-center gap-3'>
      {live ? (
        <span className='relative flex h-2 w-2' aria-hidden='true'>
          <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75' />
          <span className='relative inline-flex h-2 w-2 rounded-full bg-crimson' />
        </span>
      ) : (
        <span className='h-2 w-2 border border-metallic-gunmetal' aria-hidden='true' />
      )}
      <h2
        id={id}
        className={`font-display text-xs font-extrabold uppercase tracking-ultra ${
          live ? 'text-crimson' : 'text-metallic-chrome'
        }`}
      >
        {label}
      </h2>
      <span className='font-mono text-[10px] tabular-nums text-metallic-slate'>{count}</span>
      <span className='h-px flex-1 bg-obsidian-border' aria-hidden='true' />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Página                                                                      */
/* -------------------------------------------------------------------------- */

export default function MmaEventsPage() {
  const [selections, setSelections] = useState([]);
  const [lastBet, setLastBet] = useState(null);

  const selectedIds = useMemo(() => selections.map((item) => item.id), [selections]);

  /** Agrega una selección al boleto. Regla de casa: un pick por combate (reemplaza la cuota previa del mismo evento). */
  const addSelection = useCallback((selection) => {
    setSelections((prev) => [
      ...prev.filter((item) => item.eventId !== selection.eventId),
      selection,
    ]);
  }, []);

  /** Elimina una selección individual (disparado desde el BetSlip o al tocar la cuota activa). */
  const removeSelection = useCallback((selectionId) => {
    setSelections((prev) => prev.filter((item) => item.id !== selectionId));
  }, []);

  /** Envío simulado: reemplazar por `apiClient.post('/bets', payload)` cuando exista backend. */
  const placeBet = useCallback(async ({ selections: picks, stake, totalOdds, potentialPayout }) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    setLastBet({ count: picks.length, stake, totalOdds, potentialPayout });
    setSelections([]);
  }, []);

  const handleDismissConfirmation = useCallback(() => setLastBet(null), []);

  const cardProps = {
    selectedIds,
    onAddSelection: addSelection,
    onRemoveSelection: removeSelection,
  };

  return (
    <div className='bg-gradient-obsidian-radial'>
      <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8'>
        {/* Encabezado de cartelera */}
        <header className='border-brutal-cold relative flex flex-wrap items-end justify-between gap-4 px-5 py-5'>
          <div className='min-w-0'>
            <p className='flex items-center gap-2 text-[10px] font-bold uppercase tracking-ultra text-crimson'>
              <Swords size={12} aria-hidden='true' />
              Zenbet · Sportsbook
            </p>
            <h1 className='mt-2 font-display text-2xl font-extrabold uppercase tracking-tightest text-white sm:text-3xl'>
              Cartelera MMA
            </h1>
            <p className='mt-1 max-w-xl text-xs leading-relaxed text-metallic-titanium'>
              Combates de UFC en vivo y programados. Selecciona una cuota Moneyline para agregarla
              al boleto.
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span className='inline-flex items-center gap-2 border border-crimson/60 bg-crimson/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-brutal text-crimson'>
              <span className='relative flex h-1.5 w-1.5' aria-hidden='true'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-80' />
                <span className='relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson' />
              </span>
              {LIVE_EVENTS.length} en vivo
            </span>
            <span className='border border-obsidian-border bg-obsidian-elevated px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-brutal text-metallic-titanium'>
              {EVENTS.length} combates
            </span>
          </div>
        </header>

        {/* Confirmación de apuesta */}
        {lastBet && (
          <div
            role='status'
            className='border-brutal-gold relative flex flex-wrap items-center justify-between gap-3 px-4 py-3'
          >
            <div className='flex items-center gap-3'>
              <CheckCircle2 size={18} className='shrink-0 text-gold' aria-hidden='true' />
              <div>
                <p className='font-display text-xs font-extrabold uppercase tracking-brutal text-gold'>
                  Apuesta confirmada
                </p>
                <p className='mt-0.5 font-mono text-[10px] tabular-nums text-metallic-titanium'>
                  {lastBet.count} {lastBet.count === 1 ? 'selección' : 'selecciones'} · Stake{' '}
                  {MONEY_FORMATTER.format(lastBet.stake)} · Cuota ×{lastBet.totalOdds.toFixed(2)}
                </p>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <span className='font-mono text-sm font-extrabold tabular-nums text-gold'>
                {MONEY_FORMATTER.format(lastBet.potentialPayout)}
              </span>
              <button
                type='button'
                onClick={handleDismissConfirmation}
                aria-label='Descartar confirmación'
                className='border border-transparent p-1 text-metallic-slate transition-colors hover:border-gold/50 hover:text-gold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold'
              >
                <X size={14} aria-hidden='true' />
              </button>
            </div>
          </div>
        )}

        {/* Layout de dos columnas: cartelera + boleto sticky */}
        <div className='grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
          <div className='flex min-w-0 flex-col gap-8'>
            <section aria-labelledby='live-heading' className='flex flex-col gap-4'>
              <SectionHeading id='live-heading' label='En vivo' count={LIVE_EVENTS.length} live />
              {LIVE_EVENTS.map((event) => (
                <EventCard key={event.id} event={event} {...cardProps} />
              ))}
            </section>

            <section aria-labelledby='scheduled-heading' className='flex flex-col gap-4'>
              <SectionHeading
                id='scheduled-heading'
                label='Próximos combates'
                count={SCHEDULED_EVENTS.length}
              />
              {SCHEDULED_EVENTS.map((event) => (
                <EventCard key={event.id} event={event} {...cardProps} />
              ))}
            </section>
          </div>

          <BetSlip
            selections={selections}
            onRemoveSelection={removeSelection}
            onPlaceBet={placeBet}
            minStake={50}
            maxStake={5000}
            className='lg:sticky lg:top-6 lg:max-h-[calc(100vh_-_3rem)]'
          />
        </div>
      </div>
    </div>
  );
}
