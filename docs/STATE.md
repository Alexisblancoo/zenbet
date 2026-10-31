# ZenBet // Estado de Investigación & Hipótesis

## Fase Metodológica
- **Fase Actual:** **Fase 6: Despliegue de Producción, Orquestación Docker y Refinamiento UI de Íconos de Deportes con Identidad Crimson (#FF3F7F) (Completada & Certificada)**
- **Próxima Fase:** **Operación en Vivo y Monitoreo de Métricas de Telemetría (Post-Release)**

---

## Hipótesis de Arquitectura y Protocolos

### Hipótesis 1: Arquitectura GraphQL Unificada con Subscriptions (Stake.com)
- **Estado:** `Confirmado`
- **Evidencia:** Endpoint centralizado `https://stake.com/_api/graphql`, operaciones de lectura (`AllSportBets`, `fixture`, `outcomes`) y mutaciones transaccionales para colocación de apuestas deportivas. WebSockets internos protegidos bajo `wss://api.stake.com/websockets` con canal de eventos push por ID de usuario y fixture.

### Hipótesis 2: Arquitectura Procedural Minificada de Doble Canal (1xBet / BetB2B)
- **Estado:** `Confirmado`
- **Evidencia:** Separación arquitectónica entre `LineFeed` (`https://1xbet.com/LineFeed/`) para apuestas previas y `LiveFeed` (`https://1xbet.com/LiveFeed/`) para juego en directo. Uso de payloads JSON altamente comprimidos con claves de un solo carácter (`I`, `N`, `E`, `GE`) para reducir el ancho de banda a millones de clientes concurrentes.

### Hipótesis 3: Arquitectura SDK con Bridge en Cliente y Session Storage (Metabet / DGBuilder / Digitain)
- **Estado:** `Confirmado`
- **Evidencia:** Exposición en el cliente de `DgBuilderAPI`, almacenamiento de credenciales en `sessionStorage["player"]` y `localStorage["authorizationData"]`. Eventos emitidos en el DOM (`dgb-event`) y control de estado de cuenta restringida mediante intercepción de `/token` (código de error `13`).

### Hipótesis 4: Arquitectura de Microservicios con Pasarela WebSocket Binaria (1win)
- **Estado:** `Probable`
- **Evidencia:** Ausencia de API pública documentada; uso de mirrors y pasarelas WS (`wss://...`) con serialización compacta y compresión para la sincronización de cuotas y estados en vivo.

### Hipótesis 5: Multiplexación por Lotes y Desacoplamiento de Socket en Viewport Churn (ZenBet Real-Time Engine)
- **Estado:** `Confirmado & Implementado`
- **Evidencia:** La rotación de mercados en el viewport del cliente generaba reconexiones continuas si el ciclo de vida del WebSocket estaba atado a los `marketIds`. Al separar la conexión persistente (`createOddsHubConnection`) de la reconciliación incremental de grupos mediante lotes (`JoinMarketGroups` / `LeaveMarketGroups`), el overhead de paquetes se reduce de $O(N)$ handshakes a $O(1)$ ráfaga de IDs, previniendo tormentas de reconexión y saturación de la memoria del cliente.

### Hipótesis 6: Validación de Deslizamiento (Anti-Slippage) en Dominio con Aborto Transaccional y Re-Quote Interactivo
- **Estado:** `Confirmado & Implementado`
- **Evidencia:** Durante la ventana de tránsito entre la intención de apuesta y la confirmación en el Ledger inmutable de PostgreSQL, las cuotas en vivo pueden variar. Si la cuota final en la base de datos es inferior a `minAcceptedOdds` (o excede `maxSlippagePercent`), el comando aborta mediante rollback transaccional sin debitar el saldo y sin persistir la clave de idempotencia fallida. La API devuelve RFC 7807 (`ProblemDetails` con código `ODDS_CHANGED`), lo que permite al cliente revertir la mutación optimista y mostrar un diálogo interactivo de re-cotización.

### Hipótesis 7: Ingesta Desacoplada de Feeds Deportivos mediante Normalización de Adaptadores y Outbox Batching
- **Estado:** `Confirmado & Implementado`
- **Evidencia:** La ingesta masiva de cuotas desde feeds externos heterogéneos (formatos compactos de 1 carácter estilo 1xBet o feeds B2B estándar tipo Sportradar) no debe bloquear las tablas transaccionales de PostgreSQL. Al utilizar `ExternalFeedNormalizer` para traducir los mensajes hacia `UpdateOddsCommand`, particionar por hash de evento y enrutar las mutaciones hacia el `OutboxWriter`, el rendimiento de ingesta escala sin contención de bloqueos contra las apuestas concurrentes de los usuarios.

### Hipótesis 8: Control de Exposición Financiera y Aislamiento de Pasivos Agregados bajo AdvisoryLock
- **Estado:** `Confirmado & Implementado`
- **Evidencia:** La validación de límites de riesgo financiero (pasivo total acumulado de la casa = $\sum \text{stake} \times \text{cuota}$) no puede depender únicamente de un pipeline previo a la transacción (`RiskValidationBehavior`), ya que múltiples solicitudes concurrentes pasarían la comprobación al mismo milisegundo antes de persistir. Al ejecutar una comprobación atómica bajo `AdvisoryLock` (clave compuesta `userMarketLockKey`) dentro de `PlaceBetCommandHandler`, el motor garantiza que ninguna apuesta coloque el pasivo agregado por encima de `MaxMarketLiability`. Ante un intento de exceder el límite, la transacción se aborta con `RollbackAsync` y se retorna RFC 7807 (`ProblemDetails` con código `EXPOSURE_LIMIT_EXCEEDED`), evitando sobregiros o descapitalización del operador bajo ráfagas de 500 solicitudes concurrentes.

### Hipótesis 9: Identidad Visual Dual Shibuya-Lime / Crimson y Orquestación en Red Aislada
- **Estado:** `Confirmado & Implementado`
- **Evidencia:** Las casas de apuestas líderes (Stake, 1xBet) utilizan acentos cromáticos de alto contraste para dirigir la atención cognitiva del apostador hacia eventos calientes o en vivo. Al combinar Lima Shibuya (#D4FF3F) para navegación activa con Magenta Neón / Crimson (#FF3F7F) para estados en vivo y selecciones alternativas sobre fondo oscuro (#0D0D0D), la UI elimina la fatiga visual. A nivel de infraestructura, aislar los contenedores en `zenbet-network` con perfiles declarativos (`api` y `full`) y healthchecks activos (`/healthz`) previene arranques prematuros del frontend antes de que el Ledger y las migraciones de PostgreSQL alcancen estado saludable.

---

## Bloqueos Técnicos y Mitigaciones
1. **Bloqueo:** Respuestas HTTP 403 Forbidden y Challenges Cloudflare en peticiones headless hacia `stake.com` y `1win.com`.
   - **Mitigación:** Documentar sobre trazas confirmadas, documentación de SDKs de terceros, contratos de ingeniería inversa conocidos y replicar en los bancos de pruebas locales de ZenBet.
2. **Bloqueo:** Redirección regional dinámica en `1xbet.com` (`302 Found` a mirrors regionales como `bol.1xbet.com`).
   - **Mitigación:** Normalizar la URL canónica de pruebas e implementar el cliente HTTP de ZenBet con manejo explícito de cabeceras de sesión (`auid`).
3. **Bloqueo Mitigado:** Tormenta de invocaciones de SignalR al hacer scroll en carteleras de alta densidad.
   - **Mitigación:** Implementada la invocación en lote (`JoinMarketGroups` / `LeaveMarketGroups`) tanto en `OddsHub.cs` como en `useLiveOdds.ts` y `useOddsHub.ts`.
4. **Bloqueo Mitigado:** Riesgo de doble débito o colocación de apuestas a cuota desactualizada bajo alta volatilidad.
   - **Mitigación:** Implementada la comprobación atómica de `ExpectedOdds` y `MaxSlippagePercent` bajo bloqueo transaccional (`AdvisoryLock` + serialización de mercado), con reversión de saldo optimista en React 19.
5. **Bloqueo Mitigado:** Contención de base de datos entre actualizaciones masivas de cuotas y colocación de apuestas concurrentes.
   - **Mitigación:** `ExternalFeedNormalizer` procesa lotes particionados por evento y escribe eventos de dominio a la tabla `Outbox`, desacoplando la publicación en tiempo real de las transacciones del Ledger.
6. **Bloqueo Mitigado:** Brecha de límite de riesgo financiero por solicitudes concurrentes simultáneas.
   - **Mitigación:** Evaluación de doble capa: rápida en `RiskValidationBehavior` (para rechazar de inmediato sin tocar la base de datos) y atómica dentro de la sección crítica de `PlaceBetCommandHandler` bajo `userMarketLockKey`, abortando limpiamente con RFC 7807 (`EXPOSURE_LIMIT_EXCEEDED`).
