# Zenbet Events Markets Module

Clean Architecture implementation for the Events/Markets submodule of Zenbet betting platform.

## Architecture

```
src/
├── Zenbet.EventsMarkets.Domain/          # Domain layer (no external dependencies)
│   ├── Aggregates/                       # Event, Market, Selection
│   ├── ValueObjects/                     # Odd, EventId, MarketId, SelectionId
│   ├── Enums/                            # EventStatus, MarketStatus, SettlementResult, SportType, MarketType
│   ├── Events/                           # Domain Events (Outbox pattern)
│   ├── Repositories/                     # Repository interfaces
│   ├── Exceptions/                       # Domain exceptions
│   └── Common/                           # AggregateRoot, Entity base classes
│
├── Zenbet.EventsMarkets.Application/     # Use Cases layer
│   ├── Commands/
│   │   ├── SettleMarket/                 # Atomic settlement with idempotency + outbox
│   │   └── UpdateOdds/                   # High-throughput bulk odds updates (COPY + Channels)
│   ├── Queries/
│   ├── DTOs/
│   ├── Interfaces/
│   └── Behaviors/                        # MediatR pipeline behaviors
│
├── Zenbet.EventsMarkets.Infrastructure/  # Infrastructure layer
│   ├── Persistence/
│   │   ├── Configurations/               # EF Core entity configurations
│   │   ├── Repositories/                 # Repository implementations
│   │   ├── DbContext/                    # EventsMarketsDbContext
│   │   ├── Interceptors/                 # DomainEvents, SoftDelete interceptors
│   │   └── Outbox/                       # Outbox/Inbox pattern implementations
│   ├── Messaging/
│   │   ├── OutboxProcessor.cs            # Background service for outbox
│   │   └── InboxProcessor.cs             # Background service for inbox (advisory locks)
│   └── DependencyInjection.cs
│
└── Zenbet.EventsMarkets.Api/             # Presentation layer
    ├── Endpoints/                        # Minimal API endpoints
    └── Program.cs

tests/
└── Zenbet.EventsMarkets.Application.Tests/
    └── Commands/
        ├── SettleMarket/                 # Concurrency tests for settlement
        └── UpdateOdds/                   # Concurrency/load tests for odds updates
```

## Key Design Decisions

### 1. Settlement Concurrency (`SettleMarketCommandHandler`)
- **Atomic UPDATE with WHERE clause**: `UPDATE markets SET status='SETTLED' WHERE id=@id AND status='ACTIVE'`
- **Idempotency keys**: Stored in `idempotency_keys` table with UNIQUE constraint
- **Settlement audit**: Immutable record in `settlement_audit` table
- **Outbox pattern**: Domain events written atomically in same transaction

### 2. High-Throughput Odds Updates (`UpdateOddsCommandHandler`)
- **NpgsqlBinaryImporter (COPY)**: 10-50x faster than batched INSERT
- **System.Threading.Channels**: In-memory buffering with backpressure
- **Advisory locks per EventId**: `pg_try_advisory_xact_lock()` prevents out-of-order updates
- **Partitioning by EventId hash**: Parallel processing across workers
- **Temp table + MERGE**: Atomic bulk upsert with domain event emission

### 3. Feed Reliability (Inbox Pattern)
- **Persistent inbox table**: `inbox_messages` with at-least-once delivery
- **Background processor**: Polls unprocessed messages with exponential backoff
- **Dead letter queue**: Failed messages moved to `dead_letters` after max retries
- **Advisory locking**: Ensures FIFO processing per event

## Running Tests

### Prerequisites
- .NET 10.0 SDK
- Docker (for Testcontainers and the containerized stack)

### Local Development
```bash
# From the repository root: copy .env.example to .env and fill the secrets first.
# Start PostgreSQL
docker compose up -d postgres

# Run tests
dotnet test tests/Zenbet.EventsMarkets.Application.Tests/

# Or run specific test class
dotnet test --filter "FullyQualifiedName~SettleMarketCommandHandlerConcurrencyTests"
```

### Docker
```bash
# Build and start PostgreSQL, the API and the frontend (from the repository root)
docker compose up --build

# API:      http://localhost:5000
# Frontend: http://localhost
```

Copy `.env.example` to `.env` before starting the stack and replace the
placeholder secrets. The API reads `ConnectionStrings__EventsMarkets`,
`Auth__SigningKey` and `Settlement__ApiKey` from the environment.

## Concurrency Test Scenarios

### SettleMarketCommandHandler
| Test | Description |
|------|-------------|
| `Concurrent_Settlement_Only_One_Succeeds_With_Atomic_Update` | 2 concurrent settlements, exactly 1 succeeds |
| `Concurrent_Settlement_Different_Winners_First_Wins` | 2 settlements with different winners |
| `Idempotent_Retry_Returns_Cached_Result` | Same idempotency key returns cached result |
| `High_Concurrency_Settlement_100_Parallel_Requests` | 100 parallel requests, exactly 1 succeeds |
| `Settlement_After_Void_Throws_InvalidOperation` | Business rule validation |

### UpdateOddsCommandHandler
| Test | Description |
|------|-------------|
| `Bulk_Update_5000_Odds_Completes_Under_Threshold` | 5000 updates < 2 seconds |
| `Concurrent_Updates_Same_Selection_Last_Write_Wins` | 100 concurrent updates to same selection |
| `Concurrent_Updates_Different_Events_Process_In_Parallel` | 5 events updated concurrently |
| `Idempotent_Update_Retry_Does_Not_Duplicate_Processing` | Duplicate idempotency key rejected |
| `Out_Of_Order_Updates_Per_Event_Are_Sequenced_Correctly` | Timestamp ordering preserved |
| `High_Throughput_Stress_Test_10k_Updates` | 10,000 updates stress test |

## Database Schema

Key tables in `events_markets` schema:
- `events` - Aggregate root with optimistic concurrency (Version)
- `markets` - Child of Event, status machine
- `selections` - Child of Market, holds current odds
- `outbox_messages` - Domain events for reliable publishing
- `inbox_messages` - Incoming feed messages for reliable processing
- `idempotency_keys` - Client-side idempotency
- `settlement_audit` - Immutable settlement records
- `dead_letters` - Failed message DLQ

## Performance Targets

| Operation | Target | Implementation |
|-----------|--------|----------------|
| Settlement latency | < 50ms p99 | Single-row UPDATE + outbox |
| Odds update throughput | > 10,000/sec | COPY + Channels + advisory locks |
| Feed processing latency | < 100ms p99 | Inbox processor with advisory locks |
| Concurrent settlements | 100+ parallel | Row-level locking + idempotency |

## Configuration

```json
{
  "ConnectionStrings": {
    "EventsMarkets": "<set via ConnectionStrings__EventsMarkets>"
  },
  "UpdateOdds": {
    "BatchSize": 500,
    "WorkerCount": 8,
    "MaxQueuedBatches": 1000
  },
  "OutboxProcessor": {
    "BatchSize": 100,
    "PollInterval": "00:00:05",
    "MaxRetries": 10
  },
  "InboxProcessor": {
    "BatchSize": 50,
    "PollInterval": "00:00:02",
    "MaxRetries": 5
  }
}
```