/**
 * Utilidades de zona horaria nativa del navegador y microdetalles tipográficos
 * estilo bookie europea/rusa.
 *
 * Formatea automáticamente las horas y fechas de los combates según el huso horario
 * local del cliente (Intl.DateTimeFormat) para que nunca vea desfases horarios.
 */

const CYRILLIC_DAYS: readonly string[] = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

export interface LocalFightDateTime {
  readonly day: string;          // Ej: "SÁB 28 OCT"
  readonly time: string;         // Ej: "22:00"
  readonly full: string;         // Ej: "SÁB 28 OCT · 22:00 (GMT-4)"
  readonly cyrillicDay: string;  // Ej: "СБ"
  readonly timeZoneAbbr: string; // Ej: "GMT-4"
  readonly isToday: boolean;
  readonly isTomorrow: boolean;
}

export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function getTimeZoneShortOffset(date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat(undefined, {
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : '';
  } catch {
    const offsetMin = -date.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    return `GMT${sign}${hours}`;
  }
}

export function formatLocalFightDateTime(startTime: string): LocalFightDateTime {
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) {
    return {
      day: startTime,
      time: '—',
      full: startTime,
      cyrillicDay: '—',
      timeZoneAbbr: '',
      isToday: false,
      isTomorrow: false,
    };
  }

  const cyrillicDay = CYRILLIC_DAYS[date.getDay()] ?? '—';
  const tzAbbr = getTimeZoneShortOffset(date);

  // Formato nativo en la zona horaria del cliente
  const dayStr = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(date)
    .replace(/,/g, '')
    .toUpperCase();

  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();

  const tzSuffix = tzAbbr ? ` (${tzAbbr})` : '';

  return {
    day: dayStr,
    time: timeStr,
    full: `${dayStr} · ${timeStr}${tzSuffix}`,
    cyrillicDay,
    timeZoneAbbr: tzAbbr,
    isToday,
    isTomorrow,
  };
}

export function formatLocalFightDay(startTime: string): string {
  const dt = formatLocalFightDateTime(startTime);
  return dt.day;
}

