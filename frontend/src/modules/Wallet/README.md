# Billetera Zenbet — Fase 5

Dashboard de saldo, apuestas y movimientos. La ruta es `/wallet`, está protegida
y se compone dentro de `MainLayout`.

## Capas

```text
pages/WalletPage.tsx                 composición de la vista
modules/Wallet/components/*          UI (hero, métricas, actividad, historiales)
hooks/useWalletDashboard.ts          caso de uso: carga, refresco y merge de sesión
services/walletService.ts            puerto WalletRepository + adapter demo
services/walletDemoData.ts           fixture histórica marcada como demo
domain/wallet.ts                     entidades, estados, métricas y formateadores
```

La UI no conoce Axios ni el fixture. Depende de `WalletSnapshot` y del caso de
uso. El saldo vivo no se copia al dominio: se lee de `AuthContext`, que ya
escucha `BALANCE_UPDATED_EVENT` después de una apuesta.

## Fuentes de datos

| Dato | Fuente | Estado |
| --- | --- | --- |
| Saldo disponible | `AuthContext.user.walletBalance` | Vivo, sincronizado por la Fase 4 |
| Apuestas de esta sesión | `BetSlipContext.receipts` | Reales; se añaden al confirmar |
| Historial histórico | `demoWalletRepository` | Demo explícita |
| Depósitos / retiros / liquidaciones | `demoWalletRepository` | Demo explícita |

### Merge de la sesión

`mergeSessionActivity(snapshot, receipts, accountId)`:

- Solo acepta recibos con `accountId === user.id`.
- Ignora `idempotentReplay` para no duplicar un `POST /bets` repetido.
- Deduplica por `betId` / `transactionId` contra el snapshot.
- Convierte cada recibo en una apuesta `pending` y en un movimiento de tipo
  `bet` con monto negativo.
- El historial de recibos vive en memoria y se limita a 25 entradas. Un refresh
  de página lo pierde; el backend todavía no expone un `GET` para recuperarlo.

## Límites reales del backend

1. **No hay endpoints de lectura.** Solo existen `POST /api/v1/bets`,
   `POST /api/v1/bets/settle`, `POST /api/v1/bets/odds` y `/health`. No hay
   `GET /wallets`, `GET /bets` ni `GET /transactions`.
2. **Las apuestas perdidas no se persisten como resultado.** `PlaceBetCommandHandler`
   deja la transacción `BetPlacement` en `Pending`; `PayoutWorker` solo crea
   `BetSettlement` para ganadoras y usa `ReferenceId == winnerSelectionId`,
   mientras que el placement guarda la idempotency key. El dashboard no puede
   reconstruir el estado `Lost` desde la base actual.
3. **El login legacy no devuelve `walletId`.** El frontend mitiga con
   `VITE_DEV_WALLET_ID`; si no está configurado, el hero muestra
   “Billetera no vinculada”.
4. **No hay seed/migración de wallets** ni endpoint para depositar/retirar. Un
   entorno limpio no tendría historial real que mostrar.
5. **Las combinadas no están soportadas por el backend** (`SelectionId` único).
   El fixture incluye una combinada solo para validar la presentación; no
   representa una apuesta aceptada por la API.

Por eso el historial extendido es demo y se marca en tres lugares: badge del
header, badge de cada panel y nota al pie. Las apuestas de la sesión sí son
reales y llevan la etiqueta “Sesión”.

## Sustituir el demo por HTTP

1. Crear `httpWalletRepository` en `services/walletService.ts`:

   ```ts
   export interface WalletRepository {
     loadSnapshot(signal?: AbortSignal): Promise<WalletSnapshot>;
   }
   ```

2. Endpoints sugeridos (a definir con backend):

   - `GET /api/v1/wallets/{walletId}` → saldo, moneda y estado.
   - `GET /api/v1/wallets/{walletId}/bets?status=&from=&to=` → apuestas.
   - `GET /api/v1/wallets/{walletId}/transactions?type=&from=&to=` → movimientos.

3. Mapear los DTO a `WalletBet` / `WalletTransaction` en el repositorio, no en la
   página. Usar `source: 'live'` y `mode: 'live'` en el snapshot.
4. Inyectarlo con `createWalletService(httpWalletRepository)` o cambiar el
   default de `walletService`.
5. Revisar el merge: si el backend ya devuelve una apuesta recién creada, el
   dedupe por `betId` evita duplicarla. Si devuelve la transacción con su ID
   real, alinear el ID de sesión (`session-${transactionId}`) con ese contrato.
6. Los badges demo desaparecen automáticamente cuando `snapshot.mode === 'live'`.

## Decisiones de UI

- Sin librería de gráficos: la actividad de 7 días usa CSS nativo y tokens.
- Los filtros son pills con `aria-pressed`; en móvil se distribuyen en dos
  columnas para que ninguna opción quede escondida en un scroll horizontal.
- Las tablas usan `scope='col'`, `caption` para lectores de pantalla y una
  versión de tarjetas en móvil y tablet. El cambio a tabla ocurre en `xl`
  (1280 px) para evitar scroll horizontal cuando aparece el sidebar.
- El estado nunca depende solo del color: cada badge incluye texto.
- Los estados vacíos explican qué hacer y ofrecen una acción real.
- No hay botones muertos de depósito/retiro: solo “Ver movimientos”,
  “Actualizar” y enlaces funcionales.
- Se respeta `prefers-reduced-motion` mediante las utilidades globales.

## Verificación

```bash
npm run typecheck
npm run lint
npm run build
```

El fixture y los cálculos se validaron con un self-test de dominio (métricas,
filtros, actividad, merge y formateadores) y la vista con un smoke-test SSR de
los estados cargando / listo / vacío.
