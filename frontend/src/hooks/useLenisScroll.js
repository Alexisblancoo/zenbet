import { useEffect, useRef } from 'react';
import Lenis from '@studio-freight/lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Registrar ScrollTrigger de forma segura
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hook para inicializar Lenis Smooth Scroll con física pesada y orgánica
 * sincronizado al 100% con el ticker y ScrollTrigger de GSAP.
 *
 * @param {Object} options Opciones de configuración
 * @param {boolean} options.enabled Activar/desactivar el scroll suave
 * @param {number} options.duration Duración de la inercia (1.2s - 1.5s para sensación pesada)
 * @param {number} options.wheelMultiplier Multiplicador de rueda del mouse (0.85 = sensación densa/táctil)
 * @returns {React.MutableRefObject<Lenis|null>} Referencia a la instancia activa de Lenis
 */
export function useLenisScroll({
  enabled = true,
  duration = 1.35,
  wheelMultiplier = 0.9,
  smoothWheel = true,
} = {}) {
  const lenisRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Instanciar Lenis con curva de desaceleración exponencial (física orgánica y pesada)
    const lenis = new Lenis({
      duration: duration,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: smoothWheel,
      wheelMultiplier: wheelMultiplier,
      touchMultiplier: 1.6,
      infinite: false,
    });

    lenisRef.current = lenis;

    // Exponer la instancia para depuración o uso global en animaciones
    window.lenis = lenis;

    // 2. Sincronizar eventos de scroll con ScrollTrigger de GSAP
    const handleScroll = () => {
      ScrollTrigger.update();
    };
    lenis.on('scroll', handleScroll);

    // 3. Conectar el loop RAF de Lenis al motor central de GSAP Ticker
    // Esto garantiza que cualquier animación de ScrollTrigger esté perfectamente sincronizada
    const tickerCallback = (time) => {
      lenis.raf(time * 1000); // GSAP trabaja en segundos, Lenis espera milisegundos
    };

    gsap.ticker.add(tickerCallback);

    // Desactivar suavizado de lag en GSAP para evitar saltos o desincronizaciones de fotogramas
    gsap.ticker.lagSmoothing(0);

    // 4. Limpieza estricta de memoria al desmontar el componente
    return () => {
      lenis.off('scroll', handleScroll);
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
      if (window.lenis === lenis) {
        delete window.lenis;
      }
    };
  }, [enabled, duration, wheelMultiplier, smoothWheel]);

  return lenisRef;
}

export default useLenisScroll;
