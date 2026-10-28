const COUNTRY_FLAG_MAP: Record<string, string> = {
  USA: '🇺🇸', US: '🇺🇸',
  BRA: '🇧🇷', BR: '🇧🇷',
  MEX: '🇲🇽', MX: '🇲🇽',
  CZE: '🇨🇿', CZ: '🇨🇿',
  THA: '🇹🇭', TH: '🇹🇭',
  JPN: '🇯🇵', JP: '🇯🇵',
  CMR: '🇨🇲', CM: '🇨🇲',
  POL: '🇵🇱', PL: '🇵🇱',
  BEL: '🇧🇪', BE: '🇧🇪',
  ESP: '🇪🇸', ES: '🇪🇸',
  GBR: '🇬🇧', GB: '🇬🇧', UK: '🇬🇧',
  RUS: '🇷🇺', RU: '🇷🇺',
  FRA: '🇫🇷', FR: '🇫🇷',
  GER: '🇩🇪', DE: '🇩🇪',
  BOL: '🇧🇴', BO: '🇧🇴',
  ARG: '🇦🇷', AR: '🇦🇷',
  CAN: '🇨🇦', CA: '🇨🇦',
  AUS: '🇦🇺', AU: '🇦🇺',
  GEO: '🇬🇪', GE: '🇬🇪',
  IRN: '🇮🇷', IR: '🇮🇷',
  KAZ: '🇰🇿', KZ: '🇰🇿',
  CHN: '🇨🇳', CN: '🇨🇳',
  SWE: '🇸🇪', SE: '🇸🇪',
  IRL: '🇮🇪', IE: '🇮🇪',
  NGA: '🇳🇬', NG: '🇳🇬',
  NZL: '🇳🇿', NZ: '🇳🇿',
  ZAF: '🇿🇦', ZA: '🇿🇦',
  ITA: '🇮🇹', IT: '🇮🇹',
  NLD: '🇳🇱', NL: '🇳🇱',
  COL: '🇨🇴', CO: '🇨🇴',
  PER: '🇵🇪', PE: '🇵🇪',
  CHL: '🇨🇱', CL: '🇨🇱',
  ECU: '🇪🇨', EC: '🇪🇨',
  URY: '🇺🇾', UY: '🇺🇾',
  PRY: '🇵🇾', PY: '🇵🇾',
  VEN: '🇻🇪', VE: '🇻🇪',
};

/**
 * Retorna el emoji de la bandera correspondiente al código ISO o abreviación.
 */
export function getCountryFlagEmoji(code?: string | null): string {
  if (!code) return '';
  const clean = code.trim().toUpperCase();
  return COUNTRY_FLAG_MAP[clean] ?? '';
}

