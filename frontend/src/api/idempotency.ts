/**
 * Idempotencia de extremo a extremo.
 *
 * La API .NET 10 exige `IdempotencyKey` en apuestas, movimientos de billetera y
 * liquidaciones. El cliente inyecta un UUID v4 por operación mutativa.
 */

export const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

/** Métodos que nunca deben duplicar efectos de negocio. */
export const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function randomHex(bytes: Uint8Array): string {
  let output = '';
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, '0');
  }
  return output;
}

/**
 * UUID v4 compatible con contextos no seguros (HTTP en LAN, WebViews).
 * En navegadores modernos usa `crypto.randomUUID`; el fallback mantiene la
 * forma RFC 4122 aunque no sea criptográfico.
 */
export function createUuidV4(): string {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex = randomHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createIdempotencyKey(): string {
  return createUuidV4();
}
