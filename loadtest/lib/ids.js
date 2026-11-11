/**
 * GUID v4 suficiente para claves de idempotencia en pruebas de carga.
 * k6 v2 expone uuidv4 como null en este build, así que no dependemos de él.
 * La unicidad combina VU + iteración + timestamp + aleatorio.
 */
export function newGuid() {
  const vu = String(__VU).padStart(8, '0');
  const iter = String(__ITER).padStart(8, '0');
  const now = Date.now().toString(16).padStart(12, '0');
  const random = Math.floor(Math.random() * 0x100000000).toString(16).padStart(8, '0');
  const hex = `${vu}${iter}${now}${random}`.slice(-32).padStart(32, '0');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
