# Zenbet / Boleto de apuestas (Fase 4)

Panel de apuestas con estado global, cuotas vivas de SignalR, idempotencia y
errores accionables. La UI nunca habla HTTP directamente: el componente consume
un contexto; el contexto orquesta el caso de uso; el servicio habla con
`POST /api/v1/bets`.

## Mapa

```text
components/BetSlip.tsx        Panel glass, tabs, alerta de cuota, stake, recibo
        │ useBetSlip()
context/betSlipState.ts       Contrato del contexto + hook (fast-refresh)
        │
context/BetSlipContext.tsx    Store global + única conexión useOddsHub
        │
services/betService.ts        POST /api/v1/bets + ProblemDetails → BetFailure
        │
domain/bets.ts                Selecciones, cuota/retorno, stake, GUID, errores
```

- **Una sola conexión SignalR**: el provider es dueño de `useOddsHub`; la
  cartelera declara sus mercados con `setVisibleMarkets()` y consume `quotes`.
- **Cuota aceptada vs. cuota viva**: `odds` es la cuota que el usuario aceptó;
  `liveOdds` se deriva del hub. Si difieren, se muestra el badge, se bloquea la
  confirmación y aparece **Aceptar nuevas cuotas**.
- **Persistencia**: el boleto vive en memoria y sobrevive a la navegación entre
  rutas. Al recargar la página se reinicia para no apostar con cuotas rancias.

## Flujo de envío

1. El usuario agrega picks desde `EventCard` (un pick por combate).
2. `BetSlipProvider` cruza cada `selectionId` con la última cotización del hub.
3. Con cuotas pendientes no se puede confirmar: primero se aceptan.
4. El stake se valida en cliente (mín/máx) y el saldo queda como advertencia
   suave: la billetera autoritativa es la del servidor.
5. `betService.placeBet()` genera/reutiliza una llave UUID v4 y envía **la misma
   llave** en `X-Idempotency-Key` y en `idempotencyKey` del cuerpo.
6. Éxito: se muestra un recibo (con `betId`/`transactionId`), se vacía el pick y
   se emite `BALANCE_UPDATED_EVENT` con `newBalance` para que `AuthContext`
   actualice el saldo visible.
7. El recibo también se guarda en `BetSlipContext.receipts` (máximo 25) con
   `eventName`, `selectionName`, `marketLabel` y `accountId`. `/wallet` los cruza
   con el historial y los muestra como apuestas `pending` de la sesión. El botón
   **Billetera** del recibo abre el dashboard.

La llave se reutiliza solo si el reintento conserva la misma intención
(`selectionId + cuota aceptada + stake`). Un fallo de red/timeout conserva la
llave; un 4xx la descarta. Así un reintento tras una respuesta perdida no
duplica el cargo.

## Manejo de errores

| Caso | Comportamiento |
| --- | --- |
| 400 / 422 | Muestra `detail`, `error` o el primer error de campo; traduce saldo insuficiente, monto inválido, billetera o selección inexistente |
| 401 | “Sesión expirada”; el interceptor ya limpia el token |
| 429 | “Demasiadas solicitudes” con `retryAfterSeconds` si el servidor lo envía |
| Sin red / timeout | Mensaje de conexión; conserva la llave de idempotencia |
| 5xx | Recomienda revisar el historial antes de reintentar |

El backend de apuestas devuelve 422 como `{ success: false, error }`; por eso
`normalizeApiError` ahora también lee `error`/`errorMessage` y los excluye de
`extensions`.

## Límites actuales del backend

- `PlaceBetCommand` acepta **una sola selección**. La pestaña “Combinada”
  calcula cuota y retorno, pero no envía: no existe endpoint batch/parlay. La UI
  lo explica y ofrece enviar una simple.
- `walletId` y `selectionId` son **GUID**. La cartelera actual usa ids mock
  (`evento::peleador`), por lo que el servicio rechaza la selección antes de
  enviar. Al conectar el feed real, esos ids deben ser GUIDs de mercado.
- No hay endpoint de billetera. `AuthUser.walletId` se normaliza si el login lo
  entrega (`walletId`, `wallet_id` o `wallet.id`). Solo en desarrollo se puede
  suplir con `VITE_DEV_WALLET_ID`.
- El historial histórico de `/wallet` es demo hasta que existan endpoints GET;
  ver `src/modules/Wallet/README.md`. Las apuestas de la sesión sí son reales.

## Variables de entorno

```bash
# frontend/.env.local
VITE_API_URL=http://localhost:5000/api/v1

# Solo desarrollo: GUID de una billetera existente para probar el flujo real.
# VITE_DEV_WALLET_ID=<guid>
```

## Verificación

```bash
npm run typecheck
npm run lint
npm run build
```
