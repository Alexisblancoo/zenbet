import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Coins,
  Tag,
  Ticket,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface BetSlipTourProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

interface TourStep {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
  readonly targets: readonly string[];
}

interface HighlightRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const STEPS: readonly TourStep[] = [
  {
    title: 'Elige tu cuota',
    description:
      'Toca una cuota de la cartelera. El boleto guarda la cuota aceptada y te avisa si la línea cambia antes de confirmar.',
    icon: Zap,
    targets: ['slip-picks', 'slip-summary'],
  },
  {
    title: 'Lee el resumen',
    description:
      'Aquí ves el monto, la cuota total y la ganancia potencial. Todo se recalcula antes de enviar la apuesta.',
    icon: Coins,
    targets: ['slip-summary', 'slip-picks'],
  },
  {
    title: 'Suma un código',
    description:
      'Si tienes un código promocional, ingrésalo en esta sección. SHIBUYA10 suma 10% extra sobre las ganancias netas.',
    icon: Tag,
    targets: ['slip-promo', 'slip-summary'],
  },
  {
    title: 'Contrae el boleto',
    description:
      'Usa este control para contraer o expandir el boleto y seguir navegando sin perder tu selección.',
    icon: ChevronUp,
    targets: ['slip-collapse', 'slip-picks'],
  },
  {
    title: 'Confirma y guarda tu ticket',
    description:
      'Al confirmar verás tu ID de ticket. Consérvalo para seguir la apuesta desde Mis apuestas o la billetera.',
    icon: Ticket,
    targets: ['slip-receipt', 'slip-submit', 'slip-picks'],
  },
];

const HIGHLIGHT_PADDING = 6;

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    window.getComputedStyle(element).visibility !== 'hidden'
  );
}

function findTarget(targets: readonly string[]): HTMLElement | null {
  for (const target of targets) {
    // La página conserva el boleto de escritorio oculto en móvil. Sin este
    // filtro, querySelector devolvería ese clon de tamaño cero y el foco de la
    // guía terminaría en la esquina superior izquierda.
    const elements = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
    for (const element of elements) {
      if (isVisible(element)) return element;
    }
  }

  return null;
}

function rectFromElement(element: HTMLElement): HighlightRect {
  const rect = element.getBoundingClientRect();
  const top = Math.max(8, rect.top - HIGHLIGHT_PADDING);
  const left = Math.max(8, rect.left - HIGHLIGHT_PADDING);

  return {
    top,
    left,
    width: Math.max(
      0,
      Math.min(window.innerWidth - left - 8, rect.width + HIGHLIGHT_PADDING * 2),
    ),
    height: rect.height + HIGHLIGHT_PADDING * 2,
  };
}

/**
 * Guía flotante del boleto móvil. El foco visual se calcula sobre el DOM real
 * para que cada paso apunte al control que explica, incluso si el usuario
 * cambió de pestaña o abrió el recibo.
 */
export default function BetSlipTour({ open, onClose }: BetSlipTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const StepIcon = step.icon;

  useEffect(() => {
    if (!open) return;

    setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => cardRef.current?.focus(), 80);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open) {
      setHighlight(null);
      return undefined;
    }

    let frame = 0;

    const measure = (shouldScroll: boolean) => {
      const element = findTarget(step.targets);
      if (!element) {
        setHighlight(null);
        return;
      }

      if (shouldScroll) {
        element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }

      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setHighlight(rectFromElement(element));
      });
    };

    const handleViewportChange = () => measure(false);

    measure(true);
    const settleTimer = window.setTimeout(() => measure(true), 320);

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open, step]);

  if (!open) return null;

  const cardAtTop = highlight
    ? highlight.top + highlight.height / 2 > window.innerHeight * 0.56
    : false;

  const cardStyle: CSSProperties = cardAtTop
    ? { top: 'max(1rem, env(safe-area-inset-top))' }
    : { bottom: 'max(1rem, env(safe-area-inset-bottom))' };

  const next = () => {
    if (isLastStep) {
      onClose();
      return;
    }

    setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
  };

  return createPortal(
    <div
      className='fixed inset-0 z-[95] min-[1400px]:hidden'
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
    >
      <button
        type='button'
        aria-label='Cerrar guía del boleto'
        onClick={onClose}
        className='absolute inset-0 h-full w-full cursor-default bg-transparent'
      />

      {!highlight ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[#03050A]/80 backdrop-blur-[2px]'
        />
      ) : null}

      {highlight ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute border-2 border-[#FFD700] transition-[top,left,width,height] duration-200 ease-out'
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow:
              '0 0 0 9999px rgba(3, 5, 10, 0.82), 0 0 32px rgba(212, 175, 55, 0.35)',
          }}
        />
      ) : null}

      <div
        ref={cardRef}
        tabIndex={-1}
        style={cardStyle}
        className='shibuya-tour-card absolute inset-x-3 mx-auto max-w-[22rem] overflow-hidden border border-[#D4AF37]/45 bg-[#07090E] text-left shadow-[0_28px_90px_-24px_rgba(0,0,0,0.98)] outline-none'
      >
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFD700] to-transparent'
        />

        <div className='flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 pb-3 pt-3.5'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <span className='grid h-9 w-9 shrink-0 place-items-center border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FFD700]'>
              <StepIcon size={16} aria-hidden='true' />
            </span>
            <div className='min-w-0'>
              <p className='font-mono text-[8px] font-bold uppercase tracking-[0.28em] text-[#D4AF37]'>
                Guía del boleto
              </p>
              <p className='mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-metallic-slate'>
                Paso {stepIndex + 1} de {STEPS.length}
              </p>
            </div>
          </div>

          <button
            type='button'
            onClick={onClose}
            aria-label='Ignorar guía'
            className='border border-transparent p-1 text-metallic-slate transition-colors duration-150 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700]'
          >
            <X size={14} aria-hidden='true' />
          </button>
        </div>

        <div className='px-4 pb-4 pt-3.5'>
          <h3
            id={titleId}
            className='font-display text-lg font-extrabold uppercase leading-tight tracking-[0.02em] text-white'
          >
            {step.title}
          </h3>
          <p className='mt-2 text-[12px] leading-relaxed text-metallic-titanium'>
            {step.description}
          </p>

          <div className='mt-4 flex gap-1.5' aria-hidden='true'>
            {STEPS.map((_, index) => (
              <span
                key={index}
                className={`h-1 flex-1 transition-colors duration-200 ${
                  index <= stepIndex ? 'bg-[#FFD700]' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          <div className='mt-4 flex items-center justify-between gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-metallic-slate transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700]'
            >
              Ignorar
            </button>

            <div className='flex items-center gap-2'>
              {stepIndex > 0 ? (
                <button
                  type='button'
                  onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                  className='inline-flex min-h-10 items-center gap-1 border border-white/10 px-3 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-metallic-platinum transition-colors duration-150 hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FFD700]'
                >
                  <ChevronLeft size={13} aria-hidden='true' />
                  Anterior
                </button>
              ) : null}

              <button
                type='button'
                onClick={next}
                className='inline-flex min-h-10 items-center gap-1.5 bg-[#D4AF37] px-4 font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#07090E] transition-all duration-150 hover:bg-[#FFD700] active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]/70'
              >
                {isLastStep ? 'Entendido' : 'Siguiente'}
                {!isLastStep ? <ChevronRight size={13} aria-hidden='true' /> : null}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
