import { useEffect, useState } from 'react';

interface CountdownProps {
  /** ISO-8601 real de inicio que entrega la API. */
  readonly startTime: string;
  readonly className?: string;
}

function format(ms: number): string {
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Cuenta regresiva hacia la hora real de inicio; no se muestra si ya empezó o la fecha es inválida. */
export default function Countdown({ startTime, className = '' }: CountdownProps) {
  const target = Date.parse(startTime);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(target)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target) || target <= now) return null;

  return (
    <span className={`tabular-nums ${className}`} aria-label='Tiempo restante para el inicio'>
      Empieza en {format(target - now)}
    </span>
  );
}
