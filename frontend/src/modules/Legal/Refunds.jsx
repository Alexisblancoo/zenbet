import { Link } from 'react-router-dom';
import { RefreshCw, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';

export default function Refunds() {
  return (
    <main className='min-h-screen w-full bg-obsidian-void text-metallic-platinum py-12 px-4 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-4xl'>
        {/* Navegación y Encabezado */}
        <div className='mb-8'>
          <Link
            to='/'
            className='inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-metallic-titanium hover:text-crimson transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson'
            aria-label='Volver al inicio'
          >
            <ArrowLeft size={14} aria-hidden='true' />
            <span>Volver a la Terminal Zenbet</span>
          </Link>

          <div className='mt-6 border-b border-obsidian-border pb-6'>
            <div className='flex items-center gap-2 font-mono text-xs uppercase tracking-ultra text-gold-imperial'>
              <RefreshCw size={16} aria-hidden='true' />
              <span>Garantía de Liquidación & Contabilidad</span>
            </div>
            <h1 className='mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white'>
              Política de Reembolsos y Cancelaciones
            </h1>
            <p className='mt-3 font-mono text-xs text-metallic-slate'>
              Reglas aplicables a eventos suspendidos, cancelados o con fallos de cuotas técnicas
            </p>
          </div>
        </div>

        {/* Secciones de Reembolsos */}
        <div className='space-y-8 font-sans text-sm leading-relaxed text-metallic-titanium'>
          {/* Sección 1 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-gold-imperial'>01.</span> Cancelación o Postergación de Combates
            </h2>
            <p className='mt-3'>
              Si un combate de artes marciales mixtas, boxeo o evento deportivo es cancelado de manera definitiva antes de su inicio, o si es postergado por más de 48 horas respecto a la fecha original programada sin reprogramación oficial inmediata, la apuesta se considerará <strong className='text-white'>NULA (Void)</strong>.
            </p>
            <div className='mt-4 flex items-start gap-3 border border-obsidian-border bg-obsidian-void p-3 text-xs text-emerald-400'>
              <CheckCircle size={16} className='shrink-0 mt-0.5' aria-hidden='true' />
              <span>
                El 100% del monto apostado (stake) se reintegra íntegramente al balance del usuario en el ledger contable sin cargos por gestión.
              </span>
            </div>
          </section>

          {/* Sección 2 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-gold-imperial'>02.</span> Combates Declarados "Sin Decisión" (No Contest)
            </h2>
            <p className='mt-3'>
              En eventos declarados oficialmente como "No Contest" (NC) por fallo técnico, descalificación previa a completar los asaltos mínimos reglamentarios o anulación por la comisión atlética, todas las selecciones directas (Moneyline) se reembolsarán en su totalidad.
            </p>
            <p className='mt-2'>
              En apuestas combinadas (parlays), la selección afectada se computará con cuota 1.00 (neutra), manteniendo activas las selecciones restantes del boleto.
            </p>
          </section>

          {/* Sección 3 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-gold-imperial'>03.</span> Depósitos y Reversiones en Criptomonedas (USDT TRC20)
            </h2>
            <p className='mt-3'>
              Debido a la naturaleza determinista e irrevocable de la blockchain TRON, los depósitos acreditados a una dirección no pueden ser revertidos directamente sobre la cadena. Sin embargo, los saldos no apostados pueden ser retirados en cualquier momento cumpliendo los protocolos estándar contra el lavado de dinero (AML).
            </p>
            <div className='mt-4 flex items-start gap-3 border border-crimson/40 bg-crimson/10 p-3 text-xs text-crimson-200'>
              <AlertTriangle size={16} className='text-crimson shrink-0 mt-0.5' aria-hidden='true' />
              <span>
                Asegúrese siempre de transferir únicamente tokens USDT sobre la red TRC20 (TRON) a la dirección provista para evitar pérdidas irreversibles en la cadena de bloques.
              </span>
            </div>
          </section>

          {/* Sección 4 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-gold-imperial'>04.</span> Solicitud de Auditoría o Disputa
            </h2>
            <p className='mt-3'>
              Cualquier discrepancia respecto a liquidaciones automáticas puede ser sometida a revisión manual del ledger financiero enviando el identificador único de la transacción a <span className='text-white font-mono'>soporte@zenbet.com</span> dentro de los 14 días posteriores a la fecha del evento.
            </p>
          </section>
        </div>

        {/* Pie de página de cumplimiento */}
        <div className='mt-10 border-t border-obsidian-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-metallic-slate'>
          <p>© 2026 Zenbet Interactive Ltd. Contabilidad Transparente.</p>
          <div className='flex items-center gap-4'>
            <Link to='/terms' className='hover:text-white transition-colors underline'>Términos</Link>
            <span>·</span>
            <Link to='/privacy' className='hover:text-white transition-colors underline'>Privacidad</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
