# Realtime — cuotas en vivo (SignalR)

## Contrato con el backend

| Elemento | Valor |
| --- | --- |
| Hub | `/odds-hub` (raíz de la API, fuera de `/api/v1`) |
| Métodos | `JoinMarketGroup(marketId)`, `LeaveMarketGroup(marketId)` (+ `JoinEventGroup`) |
| Evento | `ReceiveOddsUpdate` → `{ marketId, oddsUpdate: { selectionId, newOdd, timestamp }, timestamp }` |
| Evento | `ReceiveMarketSettled` → `{ marketId, settlementData, timestamp }` |
| Auth | `accessTokenFactory` lee `authToken`; el token se re-evalúa en cada reconexión |
| CORS | El backend ya permite `http://localhost:5173` con `AllowCredentials` |

`VITE_HUB_URL` permite apuntar el hub a otro origen; por defecto se deriva de
`VITE_API_URL` + `/odds-hub` (ej. `http://localhost:5000/odds-hub`).

## Capas

| Capa | Archivo | Rol |
| --- | --- | --- |
| Dominio | `src/domain/odds.ts` | `OddsQuote`, `OddsTrend`, `parseOddsUpdate` (tolerante a alias), `applyOddsUpdate` (merge puro). |
| Infraestructura | `src/services/realtime/oddsHub.ts` | URL, nombres de eventos/métodos, retry policy exponencial con jitter. |
| Hook | `src/hooks/useOddsHub.ts` | Estado del canal, grupos, batching por frame, watchdog y resiliencia de sesión. |

`useOddsHub` sustituye al sondeo simulado `useOddsStream.js`.

## Estados y resiliencia

- `status`: `connecting → connected → reconnecting → disconnected`.
- Caída transitoria: `withAutomaticReconnect` con backoff exponencial (1s → 30s, jitter).
- Agotada la política o cierre terminal: watchdog propio reintenta (2s → 30s) mientras exista JWT.
- 401 / logout: se detiene el canal para no reconectar con un token muerto.
- Login / token renovado (`zenbet:auth-token-changed`): el canal se reabre solo y re-suscribe los grupos.
- Sin token no se intenta conectar (evita bucles 401 si el hub se protege con `[Authorize]`).

## Rendimiento y microinteracciones

- Los mensajes se acumulan por `selectionId` y se aplican **una vez por frame** (`requestAnimationFrame`):
  ráfagas de cuotas no producen renders ni destellos en cascada.
- Cuota sin cambio → se reutiliza el mapa anterior (sin re-render).
- `OddsQuote.sequence` permite reiniciar el destello aunque el valor se repita.
- Destello por `data-trend` en `MarketMatrix` / `FightCard` (animaciones de `shibuya.css`) + flecha de tendencia.
- `prefers-reduced-motion` desactiva las animaciones desde el design system.

## Uso

```tsx
const { status, quotes, lastUpdateAt, joinMarket, leaveMarket } = useOddsHub({
  markets: MARKET_IDS, // join/leave automático de lo visible
  enabled: Boolean(user),
  onStatusChange: (status) => console.info('[hub]', status),
});
```
