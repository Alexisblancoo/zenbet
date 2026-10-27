import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldCheck, EyeOff } from 'lucide-react';

export default function Privacy() {
  return (
    <main className='min-h-screen w-full bg-canvas text-metallic-platinum py-12 px-4 sm:px-6 lg:px-8'>
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
              <Lock size={16} aria-hidden='true' />
              <span>Privacidad y Protección de Datos</span>
            </div>
            <h1 className='mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-white'>
              Política de Privacidad
            </h1>
            <p className='mt-3 font-mono text-xs text-metallic-slate'>
              Conforme a estándares internacionales de protección de datos (RGPD / GDPR) · Revisión Octubre 2026
            </p>
          </div>
        </div>

        {/* Secciones de Privacidad */}
        <div className='space-y-8 font-sans text-sm leading-relaxed text-metallic-titanium'>
          {/* Sección 1 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>01.</span> Información que Recopilamos
            </h2>
            <p className='mt-3'>
              Recopilamos únicamente la información técnica y de cuenta estrictamente indispensable para la operación del servicio:
            </p>
            <ul className='mt-3 space-y-2 list-disc list-inside text-xs sm:text-sm pl-2'>
              <li>Datos de cuenta: nombre de usuario, dirección de correo electrónico y contraseña procesada con hash BCrypt.</li>
              <li>Historial de transacciones: registros inmutables de apuestas y movimientos contables en el ledger.</li>
              <li>Registros técnicos de conexión: dirección IP, identificador de dispositivo y telemetría de latencia para prevención de fraude y ataques de denegación de servicio.</li>
              <li>Direcciones de depósito de criptomonedas (TRC20) asociadas a transacciones confirmadas en la blockchain.</li>
            </ul>
          </section>

          {/* Sección 2 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>02.</span> Uso de Cookies y Almacenamiento Local (localStorage)
            </h2>
            <p className='mt-3'>
              Zenbet emplea almacenamiento local (<code className='text-crimson bg-obsidian-void px-1.5 py-0.5 font-mono text-xs'>localStorage</code>) y cookies técnicas estrictamente necesarias para recordar sus preferencias de sesión, token de autenticación y consentimiento sobre el banner de cookies.
            </p>
            <p className='mt-2'>
              No vendemos, rentamos ni comercializamos sus datos personales o perfiles de navegación con redes publicitarias de terceros.
            </p>
          </section>

          {/* Sección 3 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>03.</span> Medidas de Seguridad y Cifrado
            </h2>
            <p className='mt-3'>
              Implementamos protocolos de seguridad multicapa para resguardar la confidencialidad de la información:
            </p>
            <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='border border-obsidian-border bg-obsidian-void p-4'>
                <div className='flex items-center gap-2 text-white font-mono text-xs uppercase font-bold'>
                  <ShieldCheck size={16} className='text-money' aria-hidden='true' />
                  <span>Cifrado en Tránsito TLS 1.3</span>
                </div>
                <p className='mt-2 text-xs text-metallic-slate'>
                  Todas las comunicaciones entre cliente y API están cifradas con suites criptográficas modernas.
                </p>
              </div>
              <div className='border border-obsidian-border bg-obsidian-void p-4'>
                <div className='flex items-center gap-2 text-white font-mono text-xs uppercase font-bold'>
                  <EyeOff size={16} className='text-crimson' aria-hidden='true' />
                  <span>Hashes No Reversibles</span>
                </div>
                <p className='mt-2 text-xs text-metallic-slate'>
                  Las contraseñas nunca se almacenan en texto plano; son encriptadas con salt individual mediante BCrypt.
                </p>
              </div>
            </div>
          </section>

          {/* Sección 4 */}
          <section className='border border-obsidian-border bg-obsidian-surface p-6 sm:p-8'>
            <h2 className='font-display text-lg font-bold uppercase tracking-wide text-white flex items-center gap-2'>
              <span className='font-mono text-crimson'>04.</span> Derechos del Usuario
            </h2>
            <p className='mt-3'>
              Usted tiene derecho a solicitar el acceso, rectificación o supresión de sus datos personales, así como a revocar su consentimiento para el procesamiento de telemetría opcional contactando a nuestro departamento de cumplimiento a través de <span className='text-white font-mono'>compliance@zenbet.com</span>.
            </p>
          </section>
        </div>

        {/* Pie de página de cumplimiento */}
        <div className='mt-10 border-t border-obsidian-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-metallic-slate'>
          <p>© 2026 Zenbet Interactive Ltd. Privacidad Garantizada.</p>
          <div className='flex items-center gap-4'>
            <Link to='/terms' className='hover:text-white transition-colors underline'>Términos</Link>
            <span>·</span>
            <Link to='/refunds' className='hover:text-white transition-colors underline'>Reembolsos</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
