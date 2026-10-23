import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, ShieldCheck, X } from 'lucide-react';

export default function ConsentNotice() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('zenbet_cookies_accepted');
      if (!consent) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem('zenbet_cookies_accepted', 'all');
    } catch (e) {
      console.warn('LocalStorage no disponible', e);
    }
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem('zenbet_cookies_accepted', 'essential');
    } catch (e) {
      console.warn('LocalStorage no disponible', e);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <aside
      role='region'
      aria-label='Consentimiento de cookies y privacidad'
      className='fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-4xl border border-obsidian-border bg-obsidian-surface/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md transition-all duration-300'
    >
      <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
        {/* Texto explicativo */}
        <div className='flex items-start gap-3 max-w-2xl'>
          <div className='hidden sm:flex h-9 w-9 shrink-0 items-center justify-center border border-crimson/60 bg-crimson/10 text-crimson'>
            <Cookie size={18} aria-hidden='true' />
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <h2 className='font-display text-xs font-bold uppercase tracking-wider text-white'>
                Privacidad & Cookies Técnicas
              </h2>
              <span className='border border-money/40 bg-money/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-money'>
                Sin Rastro Publicitario
              </span>
            </div>
            <p className='mt-1 font-sans text-xs text-metallic-titanium leading-relaxed'>
              Utilizamos cookies técnicas y almacenamiento local estrictamente necesarios para autenticación de usuario, persistencia de cuotas y ejecución atómica de apuestas. Para más información, consulta nuestra{' '}
              <Link
                to='/privacy'
                className='text-metallic-platinum underline hover:text-crimson transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
              >
                Política de Privacidad
              </Link>{' '}
              y los{' '}
              <Link
                to='/terms'
                className='text-metallic-platinum underline hover:text-crimson transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-crimson'
              >
                Términos y Condiciones
              </Link>.
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className='flex items-center gap-2.5 w-full md:w-auto shrink-0 justify-end'>
          <button
            type='button'
            onClick={handleAcceptEssential}
            className='flex-1 md:flex-initial border border-obsidian-border bg-obsidian-void px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-metallic-titanium hover:border-metallic-titanium hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson'
            aria-label='Aceptar solo cookies esenciales'
          >
            Solo Esenciales
          </button>

          <button
            type='button'
            onClick={handleAcceptAll}
            className='flex-1 md:flex-initial border border-crimson bg-crimson px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-white shadow-brutal-crimson-sm hover:bg-crimson-pure transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
            aria-label='Aceptar todas las cookies'
          >
            Aceptar Todas
          </button>
        </div>
      </div>
    </aside>
  );
}
