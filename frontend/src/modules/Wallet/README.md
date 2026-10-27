# Billetera Zenbet — Fase 7

Dashboard de saldo, apuestas y movimientos. Las rutas `/wallet`, `/my-bets` y
`/perfil` están protegidas y se componen dentro de `MainLayout`.

## Capas

```text
pages/WalletPage.tsx                 composición del dashboard
pages/MyBetsPage.tsx                 historial de tickets
pages/ProfilePage.tsx                identidad + billetera + recarga
modules/Wallet/components/*          UI (hero, métricas, historiales, recarga)
hooks/useWalletDashboard.ts          caso de uso: carga, refresco y merge de sesión
services/walletService.ts            repositorio HTTP + comando de recarga
domain/wallet.ts                     entidades, estados, métricas y formateadores
```

La UI no conoce Axios. Depende de `WalletSnapshot`, `WalletBet`,
`WalletTransaction` y del caso de uso. El saldo vivo se sincroniza con
`AuthContext` mediante `BALANCE_UPDATED_EVENT`.

## Contrato HTTP

| Dato | Endpoint | Estado |
| --- | --- | --- |
| Saldo, apuestas y movimientos | `GET /api/v1/wallet` | Real, autenticado |
| Historial de apuestas | `GET /api/v1/bets` | Real, autenticado |
| Movimientos | `GET /api/v1/wallet/transactions` | Real, autenticado |
| Recarga | `POST /api/v1/wallet/deposit` | Real, autenticado e idempotente |

El `wallet_id` se lee exclusivamente del JWT firmado. La recarga envía el monto
y el método; el backend valida el monto, aplica `Wallet.Deposit` y registra la
transacción en el historial. En este entorno de desarrollo el saldo se acredita
de inmediato y no se procesa un pago real.

`loadSnapshot` consulta `GET /wallet` y `GET /bets` en paralelo. El segundo
endpoint es el contrato explícito de `/my-bets`; si falla, el dashboard conserva
las apuestas que ya vienen en `GET /wallet`.

### Merge de la sesión

`mergeSessionActivity(snapshot, receipts, accountId)`:

- Solo acepta recibos con `accountId === user.id`.
- Ignora `idempotentReplay` para no duplicar un `POST /bets` repetido.
- Deduplica por `betId` / `transactionId` contra el snapshot.
- Convierte cada recibo en una apuesta `pending` y en un movimiento de tipo
  `bet` con monto negativo.
- El historial de recibos vive en memoria y se limita a 25 entradas.

## Economía

- Las cuentas nuevas arrancan con `$0.00`.
- El saldo solo cambia por movimientos registrados en el backend.
- La recarga está disponible en `/wallet` y en la sección `Billetera` de
  `/perfil`.
- Los movimientos de recarga se muestran como `Depósito` y estado `Completado`.

## Decisiones de UI

- Sin librería de gráficos: la actividad de 7 días usa CSS nativo y tokens.
- Los filtros son pills con `aria-pressed`; en móvil se distribuyen en dos
  columnas para que ninguna opción quede escondida en un scroll horizontal.
- Las tablas usan `scope='col'`, `caption` para lectores de pantalla y una
  versión de tarjetas en móvil y tablet. El cambio a tabla ocurre en `xl`
  (1280 px) para evitar scroll horizontal cuando aparece el sidebar.
- El estado nunca depende solo del color: cada badge incluye texto.
- Los estados vacíos explican qué hacer y ofrecen una acción real.
- La recarga valida monto mínimo/máximo y muestra el nuevo saldo tras acreditar.
- Se respeta `prefers-reduced-motion` mediante las utilidades globales.

## Verificación

```bash
npm run typecheck
npm run build
```

El flujo se validó con los endpoints reales: registro con saldo `$0.00`,
`GET /wallet` y `GET /bets` autenticados, recarga con idempotencia, apuesta y
actualización del historial.
