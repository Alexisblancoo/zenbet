import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

export default function Terms() {
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
            <div className='flex items-center gap-2 font-mono text-xs uppercase tracking-ultra text-crimson'>
              <FileText size={16} aria-hidden='true' />
              <span>Marco Legal y Normativo</span>
            </div>
            <h1 className='mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white'>
              Términos y Condiciones de Uso
            </h1>
            <p className='mt-3 font-mono text-xs text-metallic-slate'>
              Última actualización: Octubre 2026 · Versión contractual 2.4 · Aplicable a todas las transacciones financieras
            </p>
          </div>
        </div>

        {/* Contenido Legal Estructurado */}
        <div className='space-y-8 font-sans text-sm leading-relaxed text-metallic-titanium'>
          {/* Sección 1 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>01.</span> Aceptación y Capacidad Legal (+18)
            </h2>
            <p className='mt-3'>
              Al crear una cuenta, depositar fondos o realizar cualquier transacción en la plataforma Zenbet, usted certifica y garantiza que tiene al menos 18 años de edad (o la mayoría de edad legal aplicable en su jurisdicción) y que posee la capacidad legal plena para contraer obligaciones vinculantes.
            </p>
            <p className='mt-2'>
              El acceso a nuestros servicios desde territorios donde el juego y las apuestas online estén restringidos o prohibidos por ley queda expresamente vetado bajo responsabilidad exclusiva del usuario.
            </p>
          </section>

          {/* Sección 2 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>02.</span> Registro de Cuenta y Seguridad Criptográfica
            </h2>
            <p className='mt-3'>
              Cada usuario puede registrar únicamente una (1) cuenta personal e intransferible. Todas las contraseñas se almacenan mediante algoritmos de cifrado unidireccional de alta seguridad (BCrypt). Es responsabilidad exclusiva del usuario mantener la confidencialidad de sus credenciales y de cualquier factor de autenticación asociado.
            </p>
            <div className='mt-4 flex items-start gap-3 border border-obsidian-border bg-obsidian-void p-3 text-xs'>
              <CheckCircle2 size={16} className='text-money shrink-0 mt-0.5' aria-hidden='true' />
              <span>
                Zenbet nunca solicitará su contraseña o claves privadas en comunicaciones no autorizadas.
              </span>
            </div>
          </section>

          {/* Sección 3 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>03.</span> Mecánica de Apuestas y Cotizaciones en Vivo
            </h2>
            <p className='mt-3'>
              Las cuotas (odds) se cotizan en tiempo real mediante algoritmos deterministas y pueden fluctuar hasta la confirmación de la orden. Al pulsar el botón de confirmación, la transacción se ejecuta de forma atómica en el ledger contable con bloqueo pesimista de saldo.
            </p>
            <p className='mt-2'>
              En mercados de alta volatilidad o cuando los factores de riesgo del mercado indiquen desajustes de liquidez, la plataforma se reserva el derecho de aplicar deslizamientos (slippage) transparentes y retrasos de validación técnica para proteger la integridad del fondo de liquidez.
            </p>
          </section>

          {/* Sección 4 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>04.</span> Transparencia Financiera y Juego Responsable
            </h2>
            <p className='mt-3'>
              En Zenbet promovemos la transparencia absoluta. No prometemos ni garantizamos retornos financieros fijos, ganancias aseguradas ni métodos de arbitraje infalibles. Las apuestas deportivas conllevan riesgo financiero real y posibilidad de pérdida del capital apostado.
            </p>
            <p className='mt-2'>
              Recomendamos apostar únicamente fondos destinados a entretenimiento. Ponemos a disposición de los usuarios herramientas de autoexclusión y límites de depósito en la sección de perfil.
            </p>
          </section>

          {/* Sección 5 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>05.</span> Liquidación y Resolución de Disputas
            </h2>
            <p className='mt-3'>
              Todos los combates y eventos deportivos se liquidan tomando como referencia exclusiva los resultados oficiales emitidos por las comisiones atléticas u organismos deportivos correspondientes. Modificaciones posteriores a la declaración oficial en el ring no alterarán las apuestas ya saldadas en el ledger contable.
            </p>
          </section>
        </div>

        {/* Pie de página de cumplimiento */}
        <div className='mt-10 border-t border-obsidian-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-metallic-slate'>
          <p>© 2026 Zenbet Interactive Ltd. Entidad auditada y regulada.</p>
          <div className='flex items-center gap-4'>
            <Link to='/privacy' className='hover:text-white transition-colors underline'>Privacidad</Link>
            <span>·</span>
            <Link to='/refunds' className='hover:text-white transition-colors underline'>Reembolsos</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
