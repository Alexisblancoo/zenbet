# ZenBet // Decisiones Arquitectónicas (DECISIONS)

Este documento registra las decisiones clave de arquitectura de software para ZenBet, motivadas por los hallazgos de ingeniería inversa y contrastadas con alternativas descartadas.

---

## Decisión 1: Estructura Polimórfica Legible vs Claves Minificadas de 1 Letra
- **Contexto:** 1xBet utiliza claves de una sola letra (`I`, `N`, `E`, `GE`) para ahorrar ancho de banda a costa de una alta deuda técnica, ilegibilidad y fragilidad ante cambios. Stake utiliza GraphQL con modelos fuertemente tipados.
- **Decisión:** En ZenBet adoptamos **Uniones Discriminadas en Zod** (`sportType: 'mma' | 'soccer' | 'basketball' | 'tennis' | 'boxing'`) y DTOs C# fuertemente tipados con nombres semánticos. La optimización de red se delega a compresión HTTP/3 y Brotli/Gzip en el servidor web, manteniendo el código limpio, mantenible y auto-documentado.
- **Alternativa Descartada:** Minificación manual de JSON estilo 1xBet. Se descarta por violar los principios de Clean Architecture y dificultar la navegación con herramientas de IA y agentes.

---

## Decisión 2: SignalR Hubs con Grupos Dinámicos vs Conexión Monolítica
- **Contexto:** Plataformas como Digitain y Stake transmiten actualizaciones en tiempo real. Si un cliente recibe cuotas de todos los deportes del mundo, el navegador colapsa por sobrecarga de renderizado.
- **Decisión:** Implementar SignalR Hubs (`FightHub`, `OddsHub`) donde el cliente declara explícitamente qué mercados y eventos están en su viewport (`setVisibleMarkets(marketIds)`). El backend de .NET solo emite deltas a los clientes suscritos a esos grupos.
- **Alternativa Descartada:** Polling continuo REST o WebSocket sin suscripción selectiva.

---

## Decisión 3: Clave de Idempotencia Estricta (UUIDv4) en la Colocación de Apuestas
- **Contexto:** En conexiones móviles o fluctuantes en iGaming, los usuarios suelen presionar el botón de apostar varias veces si la respuesta tarda 1 segundo, generando apuestas duplicadas accidentales.
- **Decisión:** Todo comando `POST /api/v1/bets` debe incluir un `idempotencyKey` (UUIDv4) generado en el cliente al renderizar el boleto. El backend verifica en el Ledger inmutable si la clave ya fue procesada; si existe, retorna el recibo original con `idempotentReplay: true` sin debitar saldo adicional.
- **Alternativa Descartada:** Confiar en el bloqueo de botón en la UI únicamente (fácil de eludir o perder con reconexiones).

---

## Decisión 4: Tolerancia y Control de Deslizamiento de Cuotas (Slippage)
- **Contexto:** Cuando el usuario envía la apuesta a cuota 2.10, pero en los 200ms de tránsito la cuota baja a 1.95 debido a una acción en vivo.
- **Decisión:** El backend compara la `acceptedOdds` enviada en el payload con la cuota vigente en el motor. Si la cuota disminuyó más allá del umbral de tolerancia del usuario, la apuesta se rechaza con error `ODDS_CHANGED` y ProblemDetails (RFC 7807), solicitando aceptación explícita de la nueva cuota.



---

## Decisión 5: Multiplexación por Lotes en SignalR Hubs (`JoinMarketGroups` / `LeaveMarketGroups`)
- **Contexto:** En carteleras de apuestas con decenas de eventos y mercados visibles (MMA, Fútbol, Baloncesto), suscribir individualmente cada mercado dispara entre 30 y 60 invocaciones RPC secuenciales sobre el WebSocket, saturando el buffer de red y provocando bloqueos de renderizado en el cliente.
- **Decisión:** Extender `OddsHub.cs` en .NET 10 con métodos batch (`JoinMarketGroups(IReadOnlyList<string> marketIds)` y `LeaveMarketGroups(IReadOnlyList<string> marketIds)`). El cliente envía una única invocación con la lista completa de identificadores agregados o removidos.
- **Alternativa Descartada:** Invocaciones individuales en bucle `for` cliente (`connection.invoke('JoinMarketGroup', id)`). Se descarta por el sobrecosto de frames WebSocket y latencia acumulada.

---

## Decisión 6: Desacoplamiento del Ciclo de Vida del Socket frente a Rotación de Viewport
- **Contexto:** En implementaciones ingenuas de React, las dependencias del hook de WebSocket incluían `marketIds.join(',')`. Cada vez que el usuario hacía scroll o filtraba deportes, el socket se desconectaba (`connection.stop()`) y se creaba una nueva conexión (`new HubConnectionBuilder()`), provocando tormentas de reconexiones y parpadeos en la UI.
- **Decisión:** Desacoplar el ciclo de vida del `HubConnection` (atado únicamente a la bandera `enabled` y a la sesión del usuario) del ciclo de vida de los identificadores de mercado. La rotación de mercados se gestiona mediante un efecto secundario que computa la diferencia de conjuntos (`toJoin = next - current`, `toLeave = current - next`) y ejecuta invocaciones en lote sobre el socket ya conectado.
- **Alternativa Descartada:** Recrear la conexión en cada render/scroll del viewport.

---

## Decisión 7: Reconciliación Reactiva con Jitter y Control de Latencia
- **Contexto:** Caídas de red masivas o reinicios del servidor pueden provocar que miles de clientes intenten reconectarse exactamente al mismo milisegundo (Thundering Herd Problem). Además, clientes en pestañas en segundo plano pueden sufrir "socket congelado" sin emitir `onclose`.
- **Decisión:** Implementar una política `IRetryPolicy` con backoff exponencial (1s, 2s, 4s... hasta 30s) multiplicado por un factor de jitter pseudoaleatorio ($0.85$ a $1.15$). Complementar con un watchdog en el cliente y medición de frescura temporal (`lastUpdateAt` y `Date.now() - updatedAt > 2500` para animaciones visuales).
- **Alternativa Descartada:** Reintentos fijos sin jitter (provocan saturación en pico tras cortes de servicio).


---

## Decisión 8: Protocolo de Tolerancia al Deslizamiento de Cuotas (Anti-Slippage) en Dominio (.NET 10 + RFC 7807)
- **Contexto:** En apuestas en vivo (In-Play) y apuestas rápidas (QuickBet), las cuotas fluctúan en milisegundos. Si un usuario emite una orden con cuota 2.15 y en tránsito la cuota cae a 1.90, debitar fondos sin consentimiento genera fricción legal y quejas de usuarios. Si el backend simplemente reintenta o ajusta la cuota a la baja, se rompe el principio de predictibilidad transaccional.
- **Decisión:** `PlaceBetCommand` recibe `ExpectedOdds`, `MaxSlippagePercent` y `MinAcceptedOdds`. En `PlaceBetCommandHandler`, tras adquirir el `AdvisoryLock` y refrescar el agregado `Selection`, se calcula `minAllowedOdds = MinAcceptedOdds ?? (ExpectedOdds * (1 - MaxSlippagePercent / 100))`. Si `currentOdds < minAllowedOdds`, la transacción se aborta (`RollbackAsync`), la llave de idempotencia no se persiste, y se retorna un RFC 7807 `ProblemDetails` con código `ODDS_CHANGED`, informando la cuota vigente y la solicitada.
- **Alternativa Descartada:** Aceptar la apuesta a la peor cuota de forma silenciosa (práctica no ética descartada) o validar únicamente en el cliente (insuficiente ante condiciones de carrera en el servidor).

---

## Decisión 9: Rollback Optimista Inmediato y Re-Quote Interactivo en Cliente React 19
- **Contexto:** Para brindar una experiencia nativa fluida en apuestas rápidas (QuickBet), la interfaz descuenta el saldo del usuario inmediatamente en el caché de TanStack Query (`onMutate`). Sin embargo, si el backend rechaza la orden por deslizamiento de cuota (`ODDS_CHANGED`), mantener el saldo bloqueado o congelado confunde al jugador.
- **Decisión:** En `usePlaceBet`, el callback `onError` restaura de inmediato el snapshot previo del perfil (`previousProfile`) si el backend rechaza la orden. Si el error corresponde a `OddsChangedError`, se activa el estado `slippagePrompt` exponiendo `acceptNewOdds()` y `dismissSlippage()`. Al pulsar aceptar, el cliente reintenta la mutación con la nueva cuota y un nuevo `IdempotencyKey`.
- **Alternativa Descartada:** Bloquear la pantalla completa con un error genérico obligando al usuario a volver a seleccionar el mercado desde cero en la cartelera.


---

## Decisión 10: Servicio de Normalización de Feeds Externos Desacoplado de la Persistencia
- **Contexto:** Distintos proveedores de iGaming utilizan esquemas radicalmente dispares: 1xBet y BetB2B utilizan payloads minificados con claves de un solo carácter (`I`, `C`, `T`, `G`), mientras que Sportradar y Genius Sports utilizan JSON jerárquicos o formatos B2B estándar con enumeraciones en inglés. Acoplar la capa de persistencia directamente al formato de un proveedor genera fragilidad y código espagueti.
- **Decisión:** Implementar `ExternalFeedNormalizer` en la capa Application. Toda carga externa pasa por un pipeline de validación y sanitización (verificación de cuotas > 1.0, conversión de timestamps, mapeo de IDs a `Guid`), transformando la entrada heterogénea en comandos de dominio limpios (`UpdateOddsCommand` y `SettleMarketCommand`).
- **Alternativa Descartada:** Escribir controladores de base de datos personalizados por cada proveedor externo.

---

## Decisión 11: Aislamiento Concurrente en PostgreSQL mediante Particionamiento de Lotes y Outbox
- **Contexto:** Una ráfaga masiva de cambios de cuotas (ej. inicio del segundo tiempo o derribo en UFC) puede emitir cientos de modificaciones por segundo. Si estas actualizaciones bloquean las tablas de mercados o selecciones mientras los usuarios intentan apostar, se producen deadlocks y contención masiva en PostgreSQL.
- **Decisión:** `UpdateOddsCommandHandler` particiona las cuotas por hash de evento (`PartitionByEventIdHash`) y las enruta a través de un canal en memoria con workers dedicados. Los deltas confirmados se escriben en la tabla `OutboxMessages`, delegando la emisión hacia SignalR al servicio en segundo plano `OutboxProcessorBackgroundService`. Esto garantiza que los locks de apuestas de los usuarios (`AdvisoryLock` por billetera) nunca compitan contra locks de actualización de cuotas a nivel de fila.
- **Alternativa Descartada:** Transacciones distribuidas síncronas que actualizan cuotas y emiten WebSockets en el mismo hilo de ejecución del feed.

---

## Decisión 12: Evaluación Atómica de Pasivo Agregado por Mercado bajo AdvisoryLock Transaccional
- **Contexto:** En el modelo de negocio de una casa de apuestas (sportsbook), el pasivo total (liability) ante la victoria de una selección se calcula como $\sum (\text{stake} \times \text{cuota})$. Si el pasivo supera la reserva de capital asignada (`MaxMarketExposureLimit`), la casa enfrenta insolvencia o riesgo sistémico. Si la validación de exposición se realiza únicamente en un middleware o pipeline previo a la transacción (`RiskValidationBehavior`), un pico concurrente de 50 apuestas enviadas en el mismo milisegundo pasaría la comprobación simultáneamente antes de que ninguna de ellas persista, superando el límite permitido.
- **Decisión:** Implementar una arquitectura de doble capa. `RiskValidationBehavior` actúa como filtro rápido (short-circuit sin costo de locks), pero dentro de `PlaceBetCommandHandler`, una vez adquiridos los bloqueos de exclusión mutua `userMarketLockKey` y `marketLockKey` (`AdvisoryLock` sobre `MarketId`), se re-evalúa atómicamente la suma de pasivos contractuales pendientes (calculados sobre `AcceptedOdds`). Si la nueva apuesta excede `MaxMarketExposureLimit`, se aborta la transacción (`RollbackAsync`) y se devuelve un RFC 7807 `ProblemDetails` con código `EXPOSURE_LIMIT_EXCEEDED` y status 422.
- **Alternativa Descartada:** Validar la exposición financiera únicamente en triggers de base de datos o en procesos batch en segundo plano (ambas opciones permiten sobre-exposición durante ventanas de carrera).

---

## Decisión 13: Medición Percentil de Latencia (p95 y p99) y Arquitectura de Carga Asíncrona Mixta
- **Contexto:** Las métricas de tiempo promedio (mean latency) en plataformas de alta concurrencia ocultan anomalías críticas causadas por contención de bloqueos o pausas de Garbage Collection. Para certificar la capacidad de respuesta de ZenBet ante eventos masivos de UFC / fútbol, se requiere cuantificar la experiencia del 1% y 5% de usuarios más lentos.
- **Decisión:** Establecer una suite formal de micro-benchmarking (`MassiveConcurrencyBenchmarkTests`) que somete el motor a 500 solicitudes concurrentes intercaladas (400 apuestas + 100 actualizaciones de cuotas de alta frecuencia) midiendo percentiles p50, p90, p95 y p99 mediante `Stopwatch.GetTimestamp()`. La prueba valida invariantes estrictas de conservación de balance y cero sobre-exposición bajo contención de bloqueos de PostgreSQL.
- **Alternativa Descartada:** Monitoreo exclusivo de pruebas sintéticas mono-hilo (no reflejan contención de locks en transacciones concurrentes).

---

## Decisión 14: Identidad Visual Dual de Alto Rendimiento: Lima Shibuya (#D4FF3F) y Magenta Neón / Crimson (#FF3F7F)
- **Contexto:** En interfaces deportivas de alta densidad informativa, el uso de iconos genéricos de librerías comerciales (como ondas de pulso para baloncesto o trofeos genéricos para tenis) degrada la percepción de marca y genera ambigüedad. Además, un único color de acento sobrecintura visualmente la cartelera.
- **Decisión:** Diseñar una familia propietaria de íconos vectoriales de línea fina (`strokeWidth={1.75}`) adaptados a la geometría de cada disciplina (octágono MMA, balón pentagonal, esfera con canales, guante de perfil, gamepad cyberpunk, raqueta de precisión y pelota cosida). Se introduce intencionalmente la paleta dual: **Lima Shibuya (`#D4FF3F`)** para estado activo e interactividad primaria, combinado con **Magenta Neón / Crimson (`#FF3F7F`)** para eventos en vivo (`isLive`), indicadores de alta tensión y estados hover de selección alternativa sobre fondo oscuro `#0D0D0D`.
- **Alternativa Descartada:** Usar iconos Lucide genéricos no semánticos o saturar toda la interfaz con un único color fosforescente.

---

## Decisión 15: Estrategia de Orquestación Docker Multi-Perfil y Healthchecks Activos con Fallback
- **Contexto:** Levantar todo el stack (PostgreSQL + .NET 10 API + Workers + Nginx SPA) de manera uniforme dificulta las pruebas aisladas de backend y puede provocar fallos en cascada si el frontend intenta enviar tráfico antes de que el motor de migraciones y la semilla de datos de PostgreSQL concluyan.
- **Decisión:** Configurar perfiles declarativos en `docker-compose.yml`: perfil `api` (aislando Postgres y Backend .NET 10) y perfil `full` (agregando Nginx y SPA). Implementar healthchecks activos usando probes duales (`/healthz` y `/health`) en la API y Nginx sobre la red aislada `zenbet-network`. Los contenedores declaran `depends_on` condicionados a `service_healthy`, garantizando orquestación determinista y cero caídas en arranque.
- **Alternativa Descartada:** Dependencia simple de inicio de contenedor (`depends_on` sin `condition: service_healthy`) que genera errores 502 Bad Gateway temporales durante el despliegue.
