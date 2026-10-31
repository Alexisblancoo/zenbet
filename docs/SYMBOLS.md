# ZenBet // Tabla de Mapeo de Símbolos y Entidades (SYMBOLS)

Esta matriz establece la correlación unívoca entre la terminología observada en las plataformas de referencia y el modelo de dominio canónico implementado en **ZenBet** (.NET 10 Clean Architecture y React 19 / Zod).

---

| Concepto de Negocio | Stake.com | 1xBet (LineFeed/LiveFeed) | Digitain / Metabet (DGBuilder) | ZenBet Canónico (.NET / Zod) |
| :--- | :--- | :--- | :--- | :--- |
| **Disciplina / Deporte** | `sport.slug` / `category` | `I` (Sport ID), `N` (Name) | `SportId` / `SportName` | `sportKey: string` / `SportsbookSportId` |
| **Competición / Liga** | `tournament.name` | `LI` (Champ ID), `L` (Champ Name) | `CompetitionId` / `LeagueName` | `competition: string` / `league.name` |
| **Evento / Combate** | `fixture.name` / `fixture.id` | `I` (Game ID), `O1` vs `O2` | `GameId` / `EventId` | `eventId: string` / `event.id` |
| **Mercado** | `market.name` / `market.type` | `GE` (Group Market), `T` (Type) | `MarketTypeId` / `MarketName` | `marketId: string` / `marketType: string` |
| **Selección / Opción** | `outcome.name` / `outcome.id` | `E` (Event Entry ID), `C` | `SelectionId` / `SelectionName` | `selectionId: string` / `selectionName` |
| **Cuota / Coeficiente** | `outcome.odds` (Float) | `C` (Float) | `Coefficient` / `Price` | `odds: number` (Decimal, min 1.01) |
| **Línea / Hándicap** | `market.line` / `spread` | `P` (Param / Line) | `BaseLine` / `Points` | `line: number \| null` |
| **Estado del Evento** | `status` (ACTIVE/FINISHED) | `S` (Status Code) | `EventStatus` | `status: EventStatus` ('upcoming', 'live', 'finished', 'suspended') |
| **Reloj de Juego / Round** | `clock.current` | `TIME` / `PERIOD` | `MatchTime` / `CurrentMinute` | `clock: FightClock` / `FootballClock` |
| **Boleto de Apuestas** | `betSlip` | `Coupon` / `Express` | `BetSlipWidget` | `BetSlip` / `useBetSlip` |
| **Monto Apostado** | `amount` | `Summa` / `Stake` | `StakeAmount` | `stake: number` |
| **Ganancia Potencial** | `potentialPayout` | `Win` | `PossibleWin` | `potentialPayout: number` |
| **Idempotencia de Apuesta** | `iid` | `Guid` / `TrackId` | `BetToken` | `idempotency_key: Guid` |
| **Saldo de Billetera** | `balance.amount` | `UserBalance` | `sessionStorage["balance"]` | `wallet.Balance: decimal` |
| **Token de Sesión** | `x-access-token` | `auid` | `authorizationData.access_token`| `jwt: string` (Bearer Token) |

