/**
 * Adaptador de compatibilidad.
 *
 * La implementación real vive en `src/api/client.ts` (Axios, JWT Bearer,
 * idempotencia y normalización RFC 7807). Este archivo se conserva para que
 * los imports existentes de `@/services/apiClient` sigan funcionando sin
 * cambios.
 */
export { default, apiClient } from '../api/client';
