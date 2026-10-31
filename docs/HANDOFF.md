# ZenBet // Estado de Handover (Reversión y Arquitectura iGaming)

## 1. Estado Actual
- **Fase Activa:** **Fase 6: Despliegue de Producción, Orquestación Docker y Refinamiento UI de Íconos de Deportes con Identidad Crimson (#FF3F7F) (Completada & Certificada)**.
- **Objetivos Inspeccionados:**
  1. `stake.com` (Arquitectura GraphQL + WebSocket Push + Mutaciones Transaccionales).
  2. `1xbet.com` / `bol.1xbet.com` (Arquitectura LineFeed / LiveFeed procedural minificada).
  3. `metabet.tv` (Infraestructura Digitain / DGBuilder con API de sesión y eventos DOM).
  4. `1win.com` (Infraestructura de microservicios, mirrors dinámicos y pasarelas WS).

---

## 2. Qué está hecho
- [x] **Fase 1 (Reconocimiento):** Mapeo de rutas base y namespaces de API para las 4 plataformas de referencia.
- [x] Identificación de mecanismos de autenticación y tokens de sesión (`authorizationData.access_token` en Digitain, `x-access-token` / Cookies en Stake, `auid` en 1xBet).
- [x] Extracción y documentación de estructuras de datos para eventos, cuotas y mercados (1X2, Moneyline, Props, Hándicaps).
- [x] Mapeo canónico de símbolos de las 4 plataformas hacia los esquemas Zod y agregados de Dominio de ZenBet (.NET 10 Clean Architecture).
- [x] Creación de la base de conocimiento en `/docs` (`FINDINGS.md`, `SYMBOLS.md`, `STRUCTURES.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md`, `ENVIRONMENT.md`, `LOG.md`, `STATE.md`).
- [x] **Fase 2 (Mapa General & Real-Time Engine):**
  - [x] Métodos batch en `OddsHub.cs` (.NET 10): `JoinMarketGroups`, `LeaveMarketGroups`, `JoinEventGroups`, `LeaveEventGroups`.
  - [x] Desacoplamiento del ciclo de vida del WebSocket respecto a la rotación de mercados en el viewport en `useLiveOdds.ts` y `useOddsHub.ts`.
  - [x] Reconciliación incremental por diferencia de conjuntos (`toJoin` / `toLeave`) con invocación por lotes.
  - [x] Política de reintento exponencial con jitter (0.85-1.15) y watchdog temporal (`lastUpdateAt`).
- [x] **Fase 3 (Mecanismo Transaccional de Apuestas y Anti-Slippage):**
  - [x] Extensión de `PlaceBetCommand`, `PlaceBetRequest`, `PlaceBetResult` y validadores en .NET 10 con `ExpectedOdds`, `MaxSlippagePercent` y `MinAcceptedOdds`.
  - [x] Incorporación del slippage en el hash semántico de idempotencia (`IdempotencyPayloadHasher`) y comprobación atómica bajo `AdvisoryLock`.
  - [x] Aborto transaccional limpio (`RollbackAsync`) ante deslizamiento con mapeo a RFC 7807 (`ProblemDetails` con `code: ODDS_CHANGED` y extensiones `currentOdds`, `expectedOdds`).
  - [x] Excepción de dominio de primer nivel: `OddsChangedException` en `Zenbet.EventsMarkets.Domain.Exceptions`.
  - [x] Actualización de la mutación de apuestas rápidas en React 19 (`usePlaceBet` en `useWallet.ts`) con intercepción de `OddsChangedError`, reversión de saldo optimista y estado de alerta interactiva (`slippagePrompt`, `acceptNewOdds`, `dismissSlippage`).
- [x] **Fase 4 (Adaptadores de Feeds y Pruebas de Integración Concurrente):**
  - [x] Servicio de normalización de feeds externos `ExternalFeedNormalizer` con soporte para formatos minificados compactos (1xBet / BetB2B) y formatos B2B industriales (Sportradar / Betradar).
  - [x] Desacoplamiento de ingesta masiva de cuotas mediante `UpdateOddsCommandHandler`, particionamiento por hash de evento y persistencia asíncrona en `OutboxWriter`.
  - [x] Prueba de integración concurrente en XUnit (`Concurrent_PlaceBet_MultiUser_With_Dynamic_Odds_Shift_Enforces_Slippage_Tolerance`) validando 20 usuarios paralelos bajo cambio de cuota y preservación determinista del Ledger.
  - [x] Prueba de estrés concurrente en Vitest (`contract-validation.test.ts` Suite 8) validando conservación de fondos de $10,000 ante 20 mutaciones paralelas con reversión por slippage.
- [x] **Fase 5 (Certificación de Límites de Riesgo y Benchmarking Masivo):**
  - [x] Integración de las reglas de dominio `MaxMarketExposureExceededException` y `MaxUserBetLimitExceededException` en `PlaceBetCommandHandler`.
  - [x] Doble capa de validación de exposición financiera (pasivo agregado $\sum \text{stake} \times \text{cuota}$): filtro inicial en `RiskValidationBehavior` y validación atómica serializada bajo `AdvisoryLock` (`userMarketLockKey`).
  - [x] Aborto transaccional limpio (`RollbackAsync`) con respuesta RFC 7807 (`ProblemDetails` con códigos `EXPOSURE_LIMIT_EXCEEDED` y `USER_LIMIT_EXCEEDED`).
  - [x] Normalización de códigos de riesgo en frontend (`bets.ts` y `betService.ts`) con tipado estricto y copy contextualizado en español.
  - [x] Suite 9 de pruebas de contrato automatizadas para riesgo financiero en Vitest (`contract-validation.test.ts`, 35/35 pasando).
  - [x] Suite de benchmarking de alta concurrencia (`MassiveConcurrencyBenchmarkTests.cs`) simulando 500 solicitudes concurrentes (400 apuestas + 100 actualizaciones de cuotas) con reporte de percentiles p50, p90, p95 y p99.
- [x] **Fase 6 (Despliegue de Producción, Orquestación Docker y Refinamiento UI de Deportes):**
  - [x] Diseño e implementación de íconos vectoriales de línea fina dedicados (`sportVisuals.tsx`) para las 7 disciplinas (UFC/MMA, Fútbol, Baloncesto, Boxeo, Esports, Tenis, Béisbol), eliminando por completo componentes genéricos.
  - [x] Refinamiento de `SportsBentoGrid.tsx` aplicando la paleta dual Shibuya Lime (`#D4FF3F`) + Magenta Neón / Crimson (`#FF3F7F`) en badges en vivo, bordes de selección alternativa y resplandores radiales de alto contraste sobre fondo `#0D0D0D`.
  - [x] Endurecimiento de orquestación en `docker-compose.yml` con perfiles declarativos (`api` y `full`), volumen persistente `zenbet_postgres_data` y red aislada `zenbet-network`.
  - [x] Configuración de endpoints de salud activa `/health` y `/healthz` en .NET 10 (`Program.cs`) y Nginx (`nginx.conf`) con healthchecks deterministas vía `wget`.
  - [x] Verificación de calidad: compilación de producción con Vite (`vite build` en 49.9s), chequeo de tipos estricto (`tsc --noEmit` en 0 errores) y suite completa de Vitest (35/35 pruebas pasando).

---

## 3. Qué falta
- [ ] **Operación en Vivo y Telemetría:**
  - [ ] Monitoreo en tiempo real de métricas Prometheus y trazas OpenTelemetry en entorno productivo.
  - [ ] Afinamiento dinámico de cuotas con ML en el módulo de inferencia.

---

## 4. Próximos 3 Pasos Concretos
1. **Ejecutar Despliegue Local:** Probar `docker compose --profile full up -d` en host de pruebas.
2. **Validar Healthchecks:** Confirmar que `docker compose ps` muestre todos los servicios en estado `(healthy)`.
3. **Smoke Test Operativo:** Realizar una colocación de apuesta end-to-end contra la API orquestada.

---

## 5. Advertencias Técnicas
- **Aislamiento de Lotes en Outbox:** Los lotes de cuotas normalizadas desde feeds externos se escriben en la tabla `OutboxMessages` dentro de la transacción del lote. El `OutboxProcessorBackgroundService` se encarga de transmitir los deltas a SignalR (`OddsHub`), garantizando que una ráfaga externa de miles de cuotas nunca bloquee las filas de `Wallets` o `Transactions`.
- **Doble Capa de Riesgo:** No eludir la validación atómica dentro de `PlaceBetCommandHandler`. El pipeline `RiskValidationBehavior` actúa como filtro previo, pero la serialización bajo `userMarketLockKey` es el único punto que previene condiciones de carrera cuando múltiples apuestas simultáneas saturan el límite de exposición del mercado.
