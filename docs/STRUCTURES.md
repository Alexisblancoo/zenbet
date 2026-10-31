# ZenBet // Formatos de Datos y Contratos (STRUCTURES)

Este documento define las estructuras JSON extraídas de la ingeniería inversa y sus esquemas equivalentes estrictos en **TypeScript (Zod)** y **C# .NET 10 (Clean Architecture)**.

---

## 1. Contrato de Cuota en Vivo (Live Odds)

### Payload JSON de Referencia (Inspirado en Stake + Digitain)
```json
{
  "eventId": "evt-ufc-300-pereira-prochazka",
  "sportType": "mma",
  "marketId": "mkt-moneyline",
  "marketType": "moneyline",
  "selectionId": "sel-pereira-win",
  "selectionName": "Alex Pereira",
  "odds": 1.85,
  "previousOdds": 1.90,
  "trend": "down",
  "timestamp": "2026-10-31T20:55:00.000Z",
  "status": "OPEN"
}
```

### Esquema Zod en TypeScript (Frontend ZenBet)
```typescript
import { z } from 'zod';

export const LiveOddsUpdateSchema = z.object({
  eventId: z.string().min(1),
  sportType: z.enum(['mma', 'soccer', 'basketball', 'tennis', 'boxing']),
  marketId: z.string().min(1),
  marketType: z.string().min(1),
  selectionId: z.string().min(1),
  selectionName: z.string().min(1),
  odds: z.number().positive().min(1.01),
  previousOdds: z.number().positive().optional().nullable(),
  trend: z.enum(['up', 'down', 'unchanged']),
  timestamp: z.string().datetime(),
  status: z.enum(['OPEN', 'SUSPENDED', 'SETTLED', 'CLOSED']),
});

export type LiveOddsUpdate = z.infer<typeof LiveOddsUpdateSchema>;
```

### DTO en C# .NET 10 (Backend Clean Architecture)
```csharp
namespace Zenbet.EventsMarkets.Application.Contracts.Odds;

public sealed record LiveOddsUpdateDto(
    string EventId,
    string SportType,
    string MarketId,
    string MarketType,
    string SelectionId,
    string SelectionName,
    decimal Odds,
    decimal? PreviousOdds,
    string Trend,
    DateTimeOffset Timestamp,
    string Status
);
```

---

## 2. Contrato de Colocación de Apuesta (Place Bet Request)

### Payload JSON de Envío (Idempotente)
```json
{
  "idempotencyKey": "a9e6d420-745a-4b16-b847-9bf4244db8f2",
  "stake": 150.00,
  "promoCode": "CYBER_LIME_2026",
  "selections": [
    {
      "eventId": "evt-ufc-300-pereira-prochazka",
      "marketId": "mkt-moneyline",
      "selectionId": "sel-pereira-win",
      "acceptedOdds": 1.85
    }
  ]
}
```

### Esquema Zod en TypeScript (Frontend ZenBet)
```typescript
export const PlaceBetRequestSchema = z.object({
  idempotencyKey: z.string().uuid(),
  stake: z.number().positive().min(1.00),
  promoCode: z.string().optional().nullable(),
  selections: z.array(
    z.object({
      eventId: z.string().min(1),
      marketId: z.string().min(1),
      selectionId: z.string().min(1),
      acceptedOdds: z.number().positive().min(1.01),
    })
  ).min(1),
});

export type PlaceBetRequest = z.infer<typeof PlaceBetRequestSchema>;
```

### Comando MediatR / CQRS en C# .NET 10
```csharp
namespace Zenbet.EventsMarkets.Application.Commands.PlaceBet;

public sealed record PlaceBetCommand(
    Guid IdempotencyKey,
    Guid UserId,
    decimal Stake,
    string? PromoCode,
    IReadOnlyList<BetSelectionItem> Selections
) : IRequest<Result<BetReceiptDto>>;

public sealed record BetSelectionItem(
    string EventId,
    string MarketId,
    string SelectionId,
    decimal AcceptedOdds
);
```

---

## 3. Contrato de Recibo de Apuesta (Bet Receipt)

### Respuesta HTTP 202 / 200 OK
```json
{
  "betId": "bet-9812401",
  "transactionId": "tx-ledger-88310",
  "idempotencyKey": "a9e6d420-745a-4b16-b847-9bf4244db8f2",
  "status": "ACCEPTED",
  "totalStake": 150.00,
  "totalOdds": 1.85,
  "potentialPayout": 277.50,
  "walletBalanceAfter": 1850.00,
  "placedAt": "2026-10-31T20:55:05.120Z",
  "idempotentReplay": false
}
```

