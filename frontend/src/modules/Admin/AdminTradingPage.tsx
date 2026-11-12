/**
 * Consola de trading: el operador cotiza mercados reales.
 *
 * - Los datos salen de `GET /events` (nunca de fixtures).
 * - Cada envío va a `POST /admin/markets/{id}/pricing`; el servidor calcula y
 *   valida las cuotas. La vista previa local solo anticipa el resultado.
 * - Los combates vencidos sin resultado no se muestran al público, pero aquí
 *   aparecen como "Esperando resultado" para que operaciones los complete.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, SlidersHorizontal } from 'lucide-react';

import { isProblemDetailsException } from '@/api';
import AdminDepositsPanel from './AdminDepositsPanel';
import { isReferenceLine, marketSourceLabel, type UfcEvent, type UfcMarket, type UfcMarketSource } from '@/domain/ufc';
import {
  impliedProbabilities,
  MAX_MARGIN_PERCENT,
  MIN_MARGIN_PERCENT,
  priceMarketPreview,
  PricingPreviewError,
  type MarketPricingPreview,
} from '@/domain/trading';
import { listUfcEvents } from '@/services/ufcService';
import {
  priceMarket,
  type PriceMarketResponse,
} from '@/services/adminTradingService';
import { formatLocalFightDateTime } from '@/utils/localTimezone';

const DEFAULT_MARGIN_PERCENT = 8;

interface PricerRow {
  readonly id: string;
  readonly name: string;
  /** Probabilidad justa expresada en porcentaje (0-100). */
  percent: number;
  readonly currentOdds: number;
}

function initialRows(market: UfcMarket): readonly PricerRow[] {
  const probabilities = impliedProbabilities(market.selections.map((s) => s.decimalOdds));
  return market.selections.map((selection, index) => ({
    id: selection.id,
    name: selection.name,
    percent: Number((probabilities[index] * 100).toFixed(2)),
    currentOdds: selection.decimalOdds,
  }));
}

function sourceTone(source: UfcMarketSource | null): string {
  if (!source) return 'border-white/10 bg-white/[0.03] text-metallic-slate';
  if (source.kind === 'model') {
    return 'border-amber-400/40 bg-amber-400/10 text-amber-300';
  }
  return 'border-lime-400/40 bg-lime-400/10 text-lime-300';
}

function describeFailure(error: unknown): string {
  if (isProblemDetailsException(error)) {
    const parts = [error.title, error.detail, error.code].filter(
      (part): part is string => typeof part === 'string' && part.trim().length > 0,
    );
    return `${error.status} · ${parts.join(' — ') || 'Sin detalle del servidor'}`;
  }
  if (error instanceof PricingPreviewError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Error desconocido al cotizar el mercado.';
}

interface MarketPricerProps {
  readonly market: UfcMarket;
  readonly onPriced: (result: PriceMarketResponse) => void;
}

function MarketPricer({ market, onPriced }: MarketPricerProps) {
  const [rows, setRows] = useState<readonly PricerRow[]>(() => initialRows(market));
  const [margin, setMargin] = useState(DEFAULT_MARGIN_PERCENT);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const preview = useMemo((): { data: MarketPricingPreview | null; error: string | null } => {
    try {
      const data = priceMarketPreview(
        rows.map((row) => ({ selectionId: row.id, fairProbability: row.percent / 100 })),
        margin,
      );
      return { data, error: null };
    } catch (error) {
      return { data: null, error: describeFailure(error) };
    }
  }, [rows, margin]);

  const fairSum = rows.reduce((total, row) => total + row.percent, 0);
  const reference = isReferenceLine(market);

  const updatePercent = (id: string, raw: string) => {
    const parsed = Number(raw);
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, percent: Number.isFinite(parsed) ? parsed : 0 } : row,
      ),
    );
    setFeedback(null);
  };

  const normalizeRows = () => {
    const total = rows.reduce((sum, row) => sum + row.percent, 0);
    if (total <= 0) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        percent: Number(((row.percent / total) * 100).toFixed(2)),
      })),
    );
    setFeedback(null);
  };

  const submit = async () => {
    if (!preview.data) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await priceMarket(market.id, {
        marginPercent: margin,
        selections: preview.data.selections.map((selection) => ({
          selectionId: selection.selectionId,
          fairProbability: selection.fairProbability,
        })),
        note: `Cotizado desde la consola de trading · margen solicitado ${margin}%`,
      });
      // El éxito se anuncia en la página: `onPriced` recarga la cartelera y este
      // componente se desmonta, así que un mensaje local se perdería.
      onPriced(result);
    } catch (error) {
      setFeedback(describeFailure(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='border border-white/[0.07] bg-[#080808] p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='font-display text-[11px] font-bold uppercase tracking-wide text-white'>
            {market.name}
            {market.line !== null ? ` ${market.line.toFixed(1)}` : ''}
          </span>
          <span
            className={`border px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wide ${sourceTone(
              market.source,
            )}`}
          >
            {marketSourceLabel(market.source)}
          </span>
          <span className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
            {market.selections.length} selecciones · estado {market.status}
          </span>
        </div>
        <label className='flex items-center gap-2 font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          Margen %
          <input
            type='number'
            min={MIN_MARGIN_PERCENT}
            max={MAX_MARGIN_PERCENT}
            step={0.5}
            value={margin}
            onChange={(event) => {
              setMargin(Number(event.target.value));
              setFeedback(null);
            }}
            aria-label={`Margen de casa para ${market.name}`}
            className='w-16 border border-white/15 bg-obsidian-void px-2 py-1 font-mono text-[11px] text-white focus:border-lime-400 focus:outline-none'
          />
        </label>
      </div>

      {reference && (
        <p className='mt-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide text-amber-300'>
          <ShieldAlert size={10} aria-hidden='true' />
          Línea de referencia: no es apostable hasta que la cotices aquí.
        </p>
      )}

      <div className='mt-2 overflow-x-auto'>
        <table className='w-full min-w-[520px] border-collapse text-left'>
          <thead>
            <tr className='font-mono text-[8px] uppercase tracking-wide text-metallic-slate'>
              <th className='py-1 pr-2 font-normal'>Selección</th>
              <th className='py-1 pr-2 font-normal'>Prob. justa %</th>
              <th className='py-1 pr-2 font-normal'>Cuota actual</th>
              <th className='py-1 font-normal'>Cuota calculada</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const priced = preview.data?.selections.find((s) => s.selectionId === row.id);
              return (
                <tr key={row.id} className='border-t border-white/[0.05]'>
                  <td className='max-w-[220px] truncate py-1.5 pr-2 text-[11px] text-white'>
                    {row.name}
                  </td>
                  <td className='py-1.5 pr-2'>
                    <input
                      type='number'
                      min={0.1}
                      max={99.9}
                      step={0.1}
                      value={row.percent}
                      onChange={(event) => updatePercent(row.id, event.target.value)}
                      aria-label={`Probabilidad justa de ${row.name}`}
                      className='w-20 border border-white/15 bg-obsidian-void px-2 py-1 font-mono text-[11px] text-white focus:border-lime-400 focus:outline-none'
                    />
                  </td>
                  <td className='py-1.5 pr-2 font-mono text-[11px] tabular-nums text-metallic-slate'>
                    {Number.isFinite(row.currentOdds) ? row.currentOdds.toFixed(2) : '—'}
                  </td>
                  <td className='py-1.5 font-mono text-[11px] font-bold tabular-nums text-lime-300'>
                    {priced ? priced.decimalOdds.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className='mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide'>
        <div className='flex flex-wrap items-center gap-3'>
          <span className={Math.abs(fairSum - 100) <= 0.5 ? 'text-metallic-slate' : 'text-crimson'}>
            Suma probable {fairSum.toFixed(2)}%
          </span>
          <span className='text-metallic-slate'>
            Margen efectivo{' '}
            <span className='text-white'>
              {preview.data ? `${preview.data.overroundPercent.toFixed(2)}%` : '—'}
            </span>
          </span>
          <button
            type='button'
            onClick={normalizeRows}
            className='border border-white/15 px-2 py-1 text-metallic-titanium transition-colors hover:border-lime-400/50 hover:text-lime-300'
          >
            Normalizar a 100%
          </button>
        </div>
        <button
          type='button'
          onClick={() => void submit()}
          disabled={submitting || !preview.data}
          className='border border-lime-400/60 bg-lime-400/10 px-3 py-1.5 font-bold text-lime-300 transition-colors hover:bg-lime-400/20 disabled:cursor-not-allowed disabled:opacity-40'
        >
          {submitting ? 'Cotizando…' : reference ? 'Cotizar y publicar' : 'Recotizar mercado'}
        </button>
      </div>

      {preview.error && (
        <p className='mt-2 flex items-start gap-1.5 border border-amber-400/30 bg-amber-400/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-amber-200'>
          <AlertTriangle size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {preview.error}
        </p>
      )}
      {feedback && (
        <p
          className='mt-2 flex items-start gap-1.5 border border-crimson/40 bg-crimson/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-crimson-300'
          role='alert'
        >
          <AlertTriangle size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {feedback}
        </p>
      )}
    </div>
  );
}

function EventPanel({
  event,
  onPriced,
}: {
  readonly event: UfcEvent;
  readonly onPriced: (result: PriceMarketResponse) => void;
}) {
  const priceableMarkets = event.markets.filter(
    (market) =>
      market.status === 'open' &&
      market.selections.length >= 2 &&
      market.selections.every((selection) => !selection.settled),
  );

  if (priceableMarkets.length === 0) return null;

  return (
    <section className='border border-white/[0.08] bg-[#050505] p-3'>
      <header className='flex flex-wrap items-baseline justify-between gap-2'>
        <h2 className='font-display text-sm font-bold uppercase tracking-wide text-white'>
          {event.competition ? `${event.competition} · ` : ''}
          {event.bout.red.name} vs {event.bout.blue.name}
        </h2>
        <span className='font-mono text-[9px] uppercase tracking-wide text-metallic-slate'>
          {formatLocalFightDateTime(event.startTime).full} · {event.status}
        </span>
      </header>
      <div className='mt-2 flex flex-col gap-2'>
        {priceableMarkets.map((market) => (
          <MarketPricer key={market.id} market={market} onPriced={onPriced} />
        ))}
      </div>
    </section>
  );
}

export default function AdminTradingPage() {
  const [events, setEvents] = useState<readonly UfcEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [lastPricedAt, setLastPricedAt] = useState<string | null>(null);
  const [pricedNotice, setPricedNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    listUfcEvents({ forceRefresh: true, pageSize: 100 })
      .then((page) => {
        if (!cancelled) setEvents(page.items);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setError(describeFailure(failure));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const onPriced = useCallback((result: PriceMarketResponse) => {
    setLastPricedAt(new Date().toISOString());
    setPricedNotice(
      `Mercado cotizado · margen efectivo ${result.overroundPercent.toFixed(2)}%${
        result.idempotentReplay ? ' · replica idempotente' : ''
      }`,
    );
    setReloadToken((token) => token + 1);
  }, []);

  const awaitingResult = useMemo(
    () => events.filter((event) => event.isExpired && event.result === null),
    [events],
  );
  const priceableEvents = useMemo(
    () => events.filter((event) => !event.isExpired),
    [events],
  );

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-6'>
      <header className='flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.08] pb-3'>
        <div>
          <p className='font-mono text-[9px] uppercase tracking-ultra text-lime-400'>
            ZenBet · Trading
          </p>
          <h1 className='mt-1 font-display text-xl font-black uppercase tracking-tight text-white'>
            Cotización de mercados
          </h1>
          <p className='mt-1 max-w-2xl text-[11px] leading-relaxed text-metallic-slate'>
            Probabilidades justas + margen (2–20%). El servidor calcula las cuotas redondeando hacia
            abajo y rechaza cualquier cotización que no alcance el margen. Aquí no hay datos de
            demostración: si la API no responde, no se muestra ningún mercado.
          </p>
        </div>
        <button
          type='button'
          onClick={() => setReloadToken((token) => token + 1)}
          disabled={loading}
          className='flex items-center gap-1.5 border border-white/15 px-3 py-1.5 font-mono text-[9px] uppercase tracking-wide text-metallic-titanium transition-colors hover:border-lime-400/50 hover:text-lime-300 disabled:opacity-40'
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} aria-hidden='true' />
          Recargar
        </button>
      </header>

      {pricedNotice && (
        <p
          className='mt-3 flex items-start gap-1.5 border border-lime-400/40 bg-lime-400/[0.06] px-2 py-1.5 text-[10px] leading-relaxed text-lime-200'
          role='status'
        >
          <CheckCircle2 size={11} className='mt-0.5 shrink-0' aria-hidden='true' />
          {pricedNotice}
        </p>
      )}

      {lastPricedAt && (
        <p className='mt-3 font-mono text-[9px] uppercase tracking-wide text-lime-300'>
          Última cotización enviada: {formatLocalFightDateTime(lastPricedAt).full}
        </p>
      )}

      {loading && (
        <p className='mt-6 font-mono text-[11px] uppercase tracking-wide text-metallic-slate'>
          Cargando mercados reales…
        </p>
      )}

      {error && !loading && (
        <div className='mt-6 flex items-start gap-2 border border-crimson/40 bg-crimson/[0.06] p-3 text-[11px] leading-relaxed text-crimson-300'>
          <AlertTriangle size={14} className='mt-0.5 shrink-0' aria-hidden='true' />
          <div>
            <p className='font-bold uppercase tracking-wide'>No se pudo cargar la cartelera</p>
            <p className='mt-1'>{error}</p>
            <p className='mt-1 text-metallic-slate'>
              No se muestran mercados de ejemplo: sin datos reales no hay nada que cotizar.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className='mt-6 border border-white/[0.08] bg-[#050505] p-4 text-[11px] text-metallic-slate'>
          La API no publicó eventos. Cuando exista una cartelera real, aparecerá aquí.
        </p>
      )}

      {!loading && !error && priceableEvents.length > 0 && (
        <section className='mt-5 flex flex-col gap-3'>
          <h2 className='flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-metallic-titanium'>
            <SlidersHorizontal size={11} aria-hidden='true' />
            Mercados abiertos ({priceableEvents.length} eventos)
          </h2>
          {priceableEvents.map((event) => (
            <EventPanel key={event.id} event={event} onPriced={onPriced} />
          ))}
        </section>
      )}

      {!loading && !error && awaitingResult.length > 0 && (
        <section className='mt-6 flex flex-col gap-2'>
          <h2 className='flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-amber-300'>
            <AlertTriangle size={11} aria-hidden='true' />
            Esperando resultado ({awaitingResult.length})
          </h2>
          <p className='text-[10px] leading-relaxed text-metallic-slate'>
            Estos combates ya vencieron y no tienen resultado oficial. No se publican en la
            cartelera pública para no presentar un desenlace inventado; registra el resultado en
            operaciones para que vuelvan a mostrarse.
          </p>
          <ul className='flex flex-col gap-1'>
            {awaitingResult.map((event) => (
              <li
                key={event.id}
                className='flex flex-wrap items-center justify-between gap-2 border border-amber-400/25 bg-amber-400/[0.04] px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-amber-100'
              >
                <span className='truncate'>
                  {event.bout.red.name} vs {event.bout.blue.name}
                </span>
                <span className='text-amber-300/80'>
                  Esperando resultado · cerró {formatLocalFightDateTime(event.endsAt).full}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AdminDepositsPanel />
    </div>
  );
}
