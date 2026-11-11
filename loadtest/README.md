# Baseline HTTP con k6

Arnés de carga para medir el API de ZenBet por HTTP real (Kestrel), sin tocar código de
backend. Genera datos deterministas, corre cuatro escenarios k6 y resume los resultados en
una tabla Markdown.

El primer baseline y su análisis están en
[`docs/benchmarks/http-k6-2026-11-11.md`](../docs/benchmarks/http-k6-2026-11-11.md).

## Requisitos

- Docker Desktop con Compose v2.24+ (usa `!override`).
- Node 20+ (probado con v24).
- Grafana k6 (probado con v2.3.0). En Windows suele quedar en
  `C:\Program Files\k6\k6.exe`; `run-baseline.ps1` lo busca ahí si no está en el `PATH`.
- Un `.env` local en la raíz (copiado de `.env.example`). Nunca se lee, imprime ni commitea.

## Aislamiento

`compose.bench.yml` levanta un stack propio sobre el `docker-compose.yml` del repo:

| Recurso | Valor aislado |
|---|---|
| Proyecto Compose | `zenbet-t1` |
| API | `http://localhost:15005` (Kestrel directo, sin nginx) |
| Frontend | `http://localhost:18080` |
| PostgreSQL | `localhost:55432` |
| Volumen | `zenbet_t1_postgres_data` |
| Red | `zenbet-t1-network` |

No reutiliza contenedores, puertos ni el volumen `zenbet_postgres_data` del entorno de
desarrollo/QA.

```powershell
docker compose -p zenbet-t1 -f docker-compose.yml -f loadtest/compose.bench.yml `
  --profile full up -d --build
```

El override activa el seeding DEMO de UFC y `Betting__AllowReferenceLines=true` solo para
este stack. `RateLimiting__Auth__PermitLimit=300` aplica únicamente a `/api/auth/*` durante
la siembra; los escenarios de carga no llaman a auth.

## Ejecución

```powershell
pwsh loadtest/run-baseline.ps1
# Omitir fases: -SkipSeed -SkipRead -SkipDistinct -SkipHot -SkipCashout
```

El runner:

1. Ejecuta `seed.mjs` (200 usuarios, un depósito demo de 1000 c/u, 48 mercados abiertos y una
   apuesta pendiente por usuario para cash out). El registro va a **4 req/s** para respetar el
   rate limit por IP; tarda ~50 s.
2. Corre cada escenario con `--summary-export` a `loadtest/results/`.
3. Muestrea CPU/RAM de los contenedores cada 2 s a `loadtest/results/<escenario>-stats.csv`.
4. Imprime el resumen con `summarize.mjs`.

Los tokens, selecciones y metadatos quedan en `loadtest/.runtime/`; `results/` y `.runtime/`
están ignorados por git. `seed.mjs` nunca imprime tokens.

## Escenarios

| Escenario | Carga | Qué mide |
|---|---|---|
| `read-events` | 50 VUs, 60 s, sleep 0.25 | `GET /api/v1/events?pageSize=50`, compresión negociada y tasa de respuestas codificadas |
| `bet-distinct` | 200 VUs, 60 s, sleep 0.25 | `POST /api/v1/bets/place` repartiendo VUs entre los 48 mercados abiertos |
| `bet-hot-market` | 200 VUs, 30 s, sleep 0.25 | Las 200 VUs apuestan al mismo mercado (contención extrema) |
| `cashout` | 200 VUs × 1 iteración | `POST /api/v1/bets/:id/cashout` en una sola ráfaga |

Variables: `BASE_URL`, `VUS`, `DURATION`, `SLEEP`, `AMOUNT`, `DATA_DIR`. En `seed.mjs`:
`SEED_USERS`, `AUTH_RATE`, `SEED_DEPOSIT`, `SEED_BET_AMOUNT`.

`lib/metrics.js` separa la latencia de respuestas exitosas (`ok_duration`) de los rechazos y
cuenta 429, 503 y otros 4xx/5xx, para que un fallo rápido por contención no se lea como una
mejora de latencia.

## Limitaciones conocidas

- **Host compartido:** k6, el API y PostgreSQL corren en la misma máquina. El cliente de carga
  compite por CPU/RAM con el servidor, así que las cifras comparan escenarios entre sí; no son
  capacidad ni techo de throughput.
- Se mide **Kestrel directo** (`:15005`), no la ruta con nginx. Los números no incluyen proxy
  ni TLS.
- `cashout` es una ráfaga de 200 peticiones concurrentes: el `req/s` de k6 refleja la duración
  de la ráfaga (~150 ms), no un throughput sostenido.
- `bet-distinct` reparte 200 VUs entre 48 mercados (~4 VUs por mercado), así que no es
  contención cero.
- k6 v2.3.0 exporta `uuidv4` de `k6/crypto` como `null`; `lib/ids.js` genera GUIDs con
  `Math.random` para las claves de idempotencia.
